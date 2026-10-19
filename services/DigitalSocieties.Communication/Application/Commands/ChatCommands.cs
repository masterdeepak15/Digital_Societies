using MediatR;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Communication.Application.Chat;
using DigitalSocieties.Communication.Domain.Entities;
using DigitalSocieties.Communication.Infrastructure.Persistence;

namespace DigitalSocieties.Communication.Application.Commands;

// Chat between neighbours. Messages are private to the people in the conversation: nothing here lets an
// admin read someone else's chat. Everything is scoped to the signed-in person's society.

internal static class ChatRules
{
    /// <summary>Sent, Delivered (everyone else has it) or Read (everyone else has read it). The sender's own phone shows ticks from this.</summary>
    public static string StatusOf(ChatMessage m, IEnumerable<ConversationMember> members)
    {
        var others = members.Where(x => x.UserId != m.SenderUserId && x.LeftAt is null).ToList();
        if (others.Count == 0) return "Sent";
        if (others.All(o => o.LastReadAt is { } r && r >= m.SentAt)) return "Read";
        if (others.All(o => o.LastDeliveredAt is { } d && d >= m.SentAt)) return "Delivered";
        return "Sent";
    }

    public static ChatMessageDto ToDto(ChatMessage m, IReadOnlyDictionary<Guid, string> names, Guid me, IEnumerable<ConversationMember> members) =>
        new(m.Id, m.ConversationId, m.SenderUserId, names.TryGetValue(m.SenderUserId, out var n) ? n : "Neighbour", m.ClientId,
            m.Kind.ToString(), m.Body, m.MediaId, m.SentAt, m.SenderUserId == me, m.SenderUserId == me ? StatusOf(m, members) : "Received");

    public static async Task<Dictionary<Guid, string>> NamesAsync(IChatDirectory dir, Guid societyId, CancellationToken ct) =>
        (await dir.ListAsync(societyId, ct)).ToDictionary(p => p.UserId, p => p.Name);
}

// ── Start a one-to-one chat ─────────────────────────────────────────────────
public sealed record StartDirectChatCommand(Guid OtherUserId) : IRequest<Result<Guid>>;

public sealed class StartDirectChatHandler : IRequestHandler<StartDirectChatCommand, Result<Guid>>
{
    private readonly CommunicationDbContext _db;
    private readonly ICurrentUser           _cu;
    private readonly IChatDirectory         _dir;
    private readonly IChatNotifier          _notifier;
    public StartDirectChatHandler(CommunicationDbContext db, ICurrentUser cu, IChatDirectory dir, IChatNotifier notifier)
        => (_db, _cu, _dir, _notifier) = (db, cu, dir, notifier);

    public async Task<Result<Guid>> Handle(StartDirectChatCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId || _cu.UserId is not { } me) return Result<Guid>.Fail("AUTH.REQUIRED", "Authentication context required.");
        if (cmd.OtherUserId == me) return Result<Guid>.Fail("CHAT.SELF", "You cannot chat with yourself.");

        var people = await _dir.ListAsync(societyId, ct);
        if (people.All(p => p.UserId != cmd.OtherUserId)) return Result<Guid>.Fail("CHAT.NOT_A_MEMBER", "That person is not in your society.");

        var key = Conversation.KeyOf(me, cmd.OtherUserId);
        var existing = await _db.Conversations.FirstOrDefaultAsync(c => c.SocietyId == societyId && c.DirectKey == key, ct);
        if (existing is not null) return Result<Guid>.Ok(existing.Id);

        var conv = Conversation.Direct(societyId, me, cmd.OtherUserId);
        _db.Conversations.Add(conv);
        _db.ConversationMembers.Add(ConversationMember.Join(conv.Id, me, false));
        _db.ConversationMembers.Add(ConversationMember.Join(conv.Id, cmd.OtherUserId, false));
        try { await _db.SaveChangesAsync(ct); }
        catch (DbUpdateException)
        {
            // Both people opened the chat at the same moment; the other request won, so use that one.
            _db.ChangeTracker.Clear();
            var won = await _db.Conversations.FirstOrDefaultAsync(c => c.SocietyId == societyId && c.DirectKey == key, ct);
            if (won is null) throw;
            return Result<Guid>.Ok(won.Id);
        }
        return Result<Guid>.Ok(conv.Id);
    }
}

// ── Create a group ──────────────────────────────────────────────────────────
public sealed record CreateGroupCommand(string Title, List<Guid> MemberUserIds) : IRequest<Result<Guid>>;

public sealed class CreateGroupValidator : AbstractValidator<CreateGroupCommand>
{
    public CreateGroupValidator()
    {
        RuleFor(x => x.Title).Must(t => !string.IsNullOrWhiteSpace(t)).MaximumLength(100).WithMessage("Give the group a name.");
        RuleFor(x => x.MemberUserIds).NotNull().Must(m => m is { Count: > 0 }).WithMessage("Choose at least one person.");
        RuleFor(x => x.MemberUserIds).Must(m => m == null || m.Distinct().Count() < Conversation.MaxGroupMembers)
            .WithMessage($"A group can have up to {Conversation.MaxGroupMembers} people.");
    }
}

public sealed class CreateGroupHandler : IRequestHandler<CreateGroupCommand, Result<Guid>>
{
    private readonly CommunicationDbContext _db;
    private readonly ICurrentUser           _cu;
    private readonly IChatDirectory         _dir;
    private readonly IChatNotifier          _notifier;
    public CreateGroupHandler(CommunicationDbContext db, ICurrentUser cu, IChatDirectory dir, IChatNotifier notifier)
        => (_db, _cu, _dir, _notifier) = (db, cu, dir, notifier);

    public async Task<Result<Guid>> Handle(CreateGroupCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId || _cu.UserId is not { } me) return Result<Guid>.Fail("AUTH.REQUIRED", "Authentication context required.");

        var wanted = cmd.MemberUserIds.Where(u => u != me).Distinct().ToList();
        var people = (await _dir.ListAsync(societyId, ct)).Select(p => p.UserId).ToHashSet();
        if (wanted.Any(u => !people.Contains(u))) return Result<Guid>.Fail("CHAT.NOT_A_MEMBER", "Everyone in a group must be in your society.");

        var conv = Conversation.Group(societyId, me, cmd.Title);
        _db.Conversations.Add(conv);
        _db.ConversationMembers.Add(ConversationMember.Join(conv.Id, me, true));
        foreach (var u in wanted) _db.ConversationMembers.Add(ConversationMember.Join(conv.Id, u, false));
        await _db.SaveChangesAsync(ct);

        await _notifier.ConversationChangedAsync(conv.Id, wanted, ct);
        return Result<Guid>.Ok(conv.Id);
    }
}

// ── Add people to a group (group admins) ────────────────────────────────────
public sealed record AddGroupMembersCommand(Guid ConversationId, List<Guid> UserIds) : IRequest<Result>;

public sealed class AddGroupMembersHandler : IRequestHandler<AddGroupMembersCommand, Result>
{
    private readonly CommunicationDbContext _db;
    private readonly ICurrentUser           _cu;
    private readonly IChatDirectory         _dir;
    private readonly IChatNotifier          _notifier;
    public AddGroupMembersHandler(CommunicationDbContext db, ICurrentUser cu, IChatDirectory dir, IChatNotifier notifier)
        => (_db, _cu, _dir, _notifier) = (db, cu, dir, notifier);

    public async Task<Result> Handle(AddGroupMembersCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId || _cu.UserId is not { } me) return Result.Fail("AUTH.REQUIRED", "Authentication context required.");

        var conv = await _db.Conversations.FirstOrDefaultAsync(c => c.Id == cmd.ConversationId && c.SocietyId == societyId, ct);
        if (conv is null) return Result.Fail("CHAT.NOT_FOUND", "Conversation not found.");
        var members = await _db.ConversationMembers.Where(m => m.ConversationId == conv.Id).ToListAsync(ct);
        var mine = members.FirstOrDefault(m => m.UserId == me && m.LeftAt is null);
        if (mine is null) return Result.Fail("FORBIDDEN", "You are not in this conversation.");
        if (conv.Type != ConversationType.Group) return Result.Fail("CHAT.NOT_A_GROUP", "People can only be added to a group.");
        if (!mine.IsAdmin) return Result.Fail("FORBIDDEN", "Only a group admin can add people.");

        var people = (await _dir.ListAsync(societyId, ct)).Select(p => p.UserId).ToHashSet();
        var wanted = cmd.UserIds.Distinct().ToList();
        if (wanted.Any(u => !people.Contains(u))) return Result.Fail("CHAT.NOT_A_MEMBER", "Everyone in a group must be in your society.");
        if (members.Count(m => m.LeftAt is null) + wanted.Count(u => members.All(m => m.UserId != u || m.LeftAt is not null)) > Conversation.MaxGroupMembers)
            return Result.Fail("CHAT.GROUP_FULL", $"A group can have up to {Conversation.MaxGroupMembers} people.");

        var added = new List<Guid>();
        foreach (var u in wanted)
        {
            var existing = members.FirstOrDefault(m => m.UserId == u);
            if (existing is null) { _db.ConversationMembers.Add(ConversationMember.Join(conv.Id, u, false)); added.Add(u); }
            else if (existing.LeftAt is not null) { existing.Rejoin(); added.Add(u); }
        }
        await _db.SaveChangesAsync(ct);
        if (added.Count > 0) await _notifier.ConversationChangedAsync(conv.Id, added, ct);
        return Result.Ok();
    }
}

// ── Leave a group ───────────────────────────────────────────────────────────
public sealed record LeaveConversationCommand(Guid ConversationId) : IRequest<Result>;

public sealed class LeaveConversationHandler : IRequestHandler<LeaveConversationCommand, Result>
{
    private readonly CommunicationDbContext _db;
    private readonly ICurrentUser           _cu;
    private readonly IChatNotifier          _notifier;
    public LeaveConversationHandler(CommunicationDbContext db, ICurrentUser cu, IChatNotifier notifier) => (_db, _cu, _notifier) = (db, cu, notifier);

    public async Task<Result> Handle(LeaveConversationCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId || _cu.UserId is not { } me) return Result.Fail("AUTH.REQUIRED", "Authentication context required.");

        var conv = await _db.Conversations.FirstOrDefaultAsync(c => c.Id == cmd.ConversationId && c.SocietyId == societyId, ct);
        if (conv is null) return Result.Fail("CHAT.NOT_FOUND", "Conversation not found.");
        var members = await _db.ConversationMembers.Where(m => m.ConversationId == conv.Id).ToListAsync(ct);
        var mine = members.FirstOrDefault(m => m.UserId == me && m.LeftAt is null);
        if (mine is null) return Result.Fail("FORBIDDEN", "You are not in this conversation.");
        if (conv.Type != ConversationType.Group) return Result.Fail("CHAT.NOT_A_GROUP", "You can only leave a group.");

        mine.Leave();
        // A group is never left without an admin: the longest-standing member takes over.
        var rest = members.Where(m => m.LeftAt is null).OrderBy(m => m.JoinedAt).ToList();
        if (rest.Count > 0 && rest.All(m => !m.IsAdmin)) rest[0].MakeAdmin(true);
        await _db.SaveChangesAsync(ct);
        return Result.Ok();
    }
}

// ── Send a message ──────────────────────────────────────────────────────────
public sealed record SendChatMessageCommand(Guid ConversationId, Guid ClientId, string Kind, string Body, string? MediaId)
    : IRequest<Result<ChatMessageDto>>;

public sealed class SendChatMessageValidator : AbstractValidator<SendChatMessageCommand>
{
    public SendChatMessageValidator()
    {
        RuleFor(x => x.Kind).Must(k => k is "Text" or "Image").WithMessage("Send text or a picture.");
        RuleFor(x => x.Body).NotNull().MaximumLength(ChatMessage.MaxBody).WithMessage($"A message can have up to {ChatMessage.MaxBody} characters.");
        RuleFor(x => x.Body).Must(b => !string.IsNullOrWhiteSpace(b)).When(x => x.Kind == "Text").WithMessage("Write a message.");
        RuleFor(x => x.MediaId).Must(m => !string.IsNullOrWhiteSpace(m)).When(x => x.Kind == "Image").WithMessage("Choose a picture.");
    }
}

public sealed class SendChatMessageHandler : IRequestHandler<SendChatMessageCommand, Result<ChatMessageDto>>
{
    private readonly CommunicationDbContext _db;
    private readonly ICurrentUser           _cu;
    private readonly IChatNotifier          _notifier;
    private readonly IChatDirectory?        _dir;
    public SendChatMessageHandler(CommunicationDbContext db, ICurrentUser cu, IChatNotifier notifier, IChatDirectory? dir = null)
        => (_db, _cu, _notifier, _dir) = (db, cu, notifier, dir);

    public async Task<Result<ChatMessageDto>> Handle(SendChatMessageCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId || _cu.UserId is not { } me)
            return Result<ChatMessageDto>.Fail("AUTH.REQUIRED", "Authentication context required.");

        var conv = await _db.Conversations.FirstOrDefaultAsync(c => c.Id == cmd.ConversationId && c.SocietyId == societyId, ct);
        if (conv is null) return Result<ChatMessageDto>.Fail("CHAT.NOT_FOUND", "Conversation not found.");
        var members = await _db.ConversationMembers.Where(m => m.ConversationId == conv.Id).ToListAsync(ct);
        var mine = members.FirstOrDefault(m => m.UserId == me && m.LeftAt is null);
        if (mine is null) return Result<ChatMessageDto>.Fail("FORBIDDEN", "You are not in this conversation.");

        var names = _dir is null ? new Dictionary<Guid, string>() : await ChatRules.NamesAsync(_dir, societyId, ct);

        // A phone that retries after a bad connection sends the same ClientId: answer with the message already stored.
        var already = await _db.ChatMessages.FirstOrDefaultAsync(m => m.SenderUserId == me && m.ClientId == cmd.ClientId, ct);
        if (already is not null) return Result<ChatMessageDto>.Ok(ChatRules.ToDto(already, names, me, members));

        var kind = cmd.Kind == "Image" ? ChatMessageKind.Image : ChatMessageKind.Text;
        var msg = ChatMessage.Create(societyId, conv.Id, me, cmd.ClientId, kind, cmd.Body ?? string.Empty, cmd.MediaId);
        _db.ChatMessages.Add(msg);
        conv.NoteMessage(msg);
        mine.Read(msg.SentAt);                       // you have, of course, read what you just wrote
        await _db.SaveChangesAsync(ct);

        var dto = ChatRules.ToDto(msg, names, me, members);
        var recipients = members.Where(m => m.LeftAt is null && m.UserId != me).Select(m => m.UserId).ToList();
        await _notifier.MessageSentAsync(societyId, dto with { IsMine = false, Status = "Received" },
            conv.Type == ConversationType.Group ? conv.Title : dto.SenderName, recipients, ct);
        return Result<ChatMessageDto>.Ok(dto);
    }
}

// ── Receipts: delivered and read ────────────────────────────────────────────
/// <summary>The phone has the messages. With no conversation id: everything waiting for this person (sent when the app comes online).</summary>
public sealed record MarkChatDeliveredCommand(Guid? ConversationId) : IRequest<Result>;

public sealed class MarkChatDeliveredHandler : IRequestHandler<MarkChatDeliveredCommand, Result>
{
    private readonly CommunicationDbContext _db;
    private readonly ICurrentUser           _cu;
    private readonly IChatNotifier          _notifier;
    public MarkChatDeliveredHandler(CommunicationDbContext db, ICurrentUser cu, IChatNotifier notifier) => (_db, _cu, _notifier) = (db, cu, notifier);

    public async Task<Result> Handle(MarkChatDeliveredCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId || _cu.UserId is not { } me) return Result.Fail("AUTH.REQUIRED", "Authentication context required.");

        var mine = await _db.ConversationMembers
            .Where(m => m.UserId == me && m.LeftAt == null && (cmd.ConversationId == null || m.ConversationId == cmd.ConversationId))
            .ToListAsync(ct);
        var ids  = mine.Select(m => m.ConversationId).ToList();
        var convs = await _db.Conversations.Where(c => ids.Contains(c.Id) && c.SocietyId == societyId).Select(c => c.Id).ToListAsync(ct);
        var now = DateTimeOffset.UtcNow;

        var changed = new List<Guid>();
        foreach (var m in mine.Where(m => convs.Contains(m.ConversationId)))
        {
            var since = m.LastDeliveredAt ?? m.JoinedAt;
            if (await _db.ChatMessages.AnyAsync(x => x.ConversationId == m.ConversationId && x.SenderUserId != me && x.SentAt > since, ct))
            {
                m.Delivered(now);
                changed.Add(m.ConversationId);
            }
        }
        if (changed.Count == 0) return Result.Ok();
        await _db.SaveChangesAsync(ct);

        foreach (var c in changed)
        {
            var others = await _db.ConversationMembers.Where(m => m.ConversationId == c && m.UserId != me && m.LeftAt == null).Select(m => m.UserId).ToListAsync(ct);
            await _notifier.ReceiptAsync(c, me, "delivered", now, others, ct);
        }
        return Result.Ok();
    }
}

/// <summary>The person opened the conversation and saw everything in it (also counts as delivered).</summary>
public sealed record MarkChatReadCommand(Guid ConversationId) : IRequest<Result>;

public sealed class MarkChatReadHandler : IRequestHandler<MarkChatReadCommand, Result>
{
    private readonly CommunicationDbContext _db;
    private readonly ICurrentUser           _cu;
    private readonly IChatNotifier          _notifier;
    public MarkChatReadHandler(CommunicationDbContext db, ICurrentUser cu, IChatNotifier notifier) => (_db, _cu, _notifier) = (db, cu, notifier);

    public async Task<Result> Handle(MarkChatReadCommand cmd, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId || _cu.UserId is not { } me) return Result.Fail("AUTH.REQUIRED", "Authentication context required.");

        var conv = await _db.Conversations.FirstOrDefaultAsync(c => c.Id == cmd.ConversationId && c.SocietyId == societyId, ct);
        if (conv is null) return Result.Fail("CHAT.NOT_FOUND", "Conversation not found.");
        var members = await _db.ConversationMembers.Where(m => m.ConversationId == conv.Id).ToListAsync(ct);
        var mine = members.FirstOrDefault(m => m.UserId == me && m.LeftAt is null);
        if (mine is null) return Result.Fail("FORBIDDEN", "You are not in this conversation.");

        var since = mine.LastReadAt ?? mine.JoinedAt;
        var hadNew = await _db.ChatMessages.AnyAsync(x => x.ConversationId == conv.Id && x.SenderUserId != me && x.SentAt > since, ct);
        var now = DateTimeOffset.UtcNow;
        mine.Read(now);
        await _db.SaveChangesAsync(ct);

        if (hadNew)
            await _notifier.ReceiptAsync(conv.Id, me, "read", now, members.Where(m => m.UserId != me && m.LeftAt is null).Select(m => m.UserId).ToList(), ct);
        return Result.Ok();
    }
}
