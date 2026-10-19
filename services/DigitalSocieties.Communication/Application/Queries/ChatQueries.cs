using MediatR;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Communication.Application.Chat;
using DigitalSocieties.Communication.Application.Commands;
using DigitalSocieties.Communication.Domain.Entities;
using DigitalSocieties.Communication.Infrastructure.Persistence;

namespace DigitalSocieties.Communication.Application.Queries;

public sealed record ConversationDto(
    Guid Id, string Type, string Title, Guid? OtherUserId, string LastMessagePreview, DateTimeOffset? LastMessageAt,
    bool LastMessageMine, int UnreadCount, bool IsOnline, DateTimeOffset? LastSeenAt, int MemberCount, bool IsAdmin);

// ── My conversations ────────────────────────────────────────────────────────
public sealed record GetConversationsQuery : IRequest<Result<List<ConversationDto>>>;

public sealed class GetConversationsHandler : IRequestHandler<GetConversationsQuery, Result<List<ConversationDto>>>
{
    private readonly CommunicationDbContext _db;
    private readonly ICurrentUser           _cu;
    private readonly IChatDirectory         _dir;
    private readonly IChatPresence          _presence;
    public GetConversationsHandler(CommunicationDbContext db, ICurrentUser cu, IChatDirectory dir, IChatPresence presence)
        => (_db, _cu, _dir, _presence) = (db, cu, dir, presence);

    public async Task<Result<List<ConversationDto>>> Handle(GetConversationsQuery q, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId || _cu.UserId is not { } me)
            return Result<List<ConversationDto>>.Fail("AUTH.REQUIRED", "Authentication context required.");

        var mine = await _db.ConversationMembers.AsNoTracking().Where(m => m.UserId == me && m.LeftAt == null).ToListAsync(ct);
        var ids = mine.Select(m => m.ConversationId).ToList();
        var convs = await _db.Conversations.AsNoTracking().Where(c => ids.Contains(c.Id) && c.SocietyId == societyId).ToListAsync(ct);
        var allMembers = await _db.ConversationMembers.AsNoTracking().Where(m => ids.Contains(m.ConversationId) && m.LeftAt == null).ToListAsync(ct);
        var names = await ChatRules.NamesAsync(_dir, societyId, ct);

        var result = new List<ConversationDto>();
        foreach (var c in convs)
        {
            var my = mine.First(m => m.ConversationId == c.Id);
            var since = my.LastReadAt ?? my.JoinedAt;
            var unread = await _db.ChatMessages.CountAsync(m => m.ConversationId == c.Id && m.SenderUserId != me && m.SentAt > since, ct);
            var members = allMembers.Where(m => m.ConversationId == c.Id).ToList();

            Guid? other = null; var title = c.Title; var online = false; DateTimeOffset? seen = null;
            if (c.Type == ConversationType.Direct)
            {
                other = members.FirstOrDefault(m => m.UserId != me)?.UserId;
                title = other is { } o && names.TryGetValue(o, out var n) ? n : "Former neighbour";
                if (other is { } who) { online = _presence.IsOnline(who); if (!online) seen = await _presence.LastSeenAsync(who, ct); }
            }
            result.Add(new ConversationDto(c.Id, c.Type.ToString(), title, other, c.LastMessagePreview, c.LastMessageAt,
                c.LastMessageSenderId == me, unread, online, seen, members.Count, my.IsAdmin));
        }
        return Result<List<ConversationDto>>.Ok(result.OrderByDescending(c => c.LastMessageAt ?? DateTimeOffset.MinValue).ToList());
    }
}

// ── The messages of one conversation ────────────────────────────────────────
/// <summary>A page of messages, oldest first. Pass `Before` (the SentAt of the oldest message you have) to load older ones.</summary>
public sealed record GetChatMessagesQuery(Guid ConversationId, DateTimeOffset? Before, int Limit) : IRequest<Result<List<ChatMessageDto>>>;

public sealed class GetChatMessagesHandler : IRequestHandler<GetChatMessagesQuery, Result<List<ChatMessageDto>>>
{
    private readonly CommunicationDbContext _db;
    private readonly ICurrentUser           _cu;
    private readonly IChatDirectory         _dir;
    public GetChatMessagesHandler(CommunicationDbContext db, ICurrentUser cu, IChatDirectory dir) => (_db, _cu, _dir) = (db, cu, dir);

    public async Task<Result<List<ChatMessageDto>>> Handle(GetChatMessagesQuery q, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId || _cu.UserId is not { } me)
            return Result<List<ChatMessageDto>>.Fail("AUTH.REQUIRED", "Authentication context required.");

        var conv = await _db.Conversations.AsNoTracking().FirstOrDefaultAsync(c => c.Id == q.ConversationId && c.SocietyId == societyId, ct);
        if (conv is null) return Result<List<ChatMessageDto>>.Fail("CHAT.NOT_FOUND", "Conversation not found.");
        var members = await _db.ConversationMembers.AsNoTracking().Where(m => m.ConversationId == conv.Id).ToListAsync(ct);
        var mine = members.FirstOrDefault(m => m.UserId == me && m.LeftAt is null);
        if (mine is null) return Result<List<ChatMessageDto>>.Fail("FORBIDDEN", "You are not in this conversation.");

        var limit = Math.Clamp(q.Limit, 1, 100);
        // Someone added to a group later does not see what was said before they joined.
        var query = _db.ChatMessages.AsNoTracking().Where(m => m.ConversationId == conv.Id && m.SentAt >= mine.JoinedAt);
        if (q.Before is { } before) query = query.Where(m => m.SentAt < before);

        var page = await query.OrderByDescending(m => m.SentAt).Take(limit).ToListAsync(ct);
        page.Reverse();

        var names = await ChatRules.NamesAsync(_dir, societyId, ct);
        return Result<List<ChatMessageDto>>.Ok(page.Select(m => ChatRules.ToDto(m, names, me, members)).ToList());
    }
}

// ── People to chat with ─────────────────────────────────────────────────────
public sealed record GetChatPeopleQuery(string? Search) : IRequest<Result<List<ChatPerson>>>;

public sealed class GetChatPeopleHandler : IRequestHandler<GetChatPeopleQuery, Result<List<ChatPerson>>>
{
    private readonly ICurrentUser   _cu;
    private readonly IChatDirectory _dir;
    public GetChatPeopleHandler(ICurrentUser cu, IChatDirectory dir) => (_cu, _dir) = (cu, dir);

    public async Task<Result<List<ChatPerson>>> Handle(GetChatPeopleQuery q, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId || _cu.UserId is not { } me)
            return Result<List<ChatPerson>>.Fail("AUTH.REQUIRED", "Authentication context required.");

        var term = q.Search?.Trim();
        var people = (await _dir.ListAsync(societyId, ct)).Where(p => p.UserId != me);
        if (!string.IsNullOrEmpty(term))
            people = people.Where(p => p.Name.Contains(term, StringComparison.OrdinalIgnoreCase) || p.Flat.Contains(term, StringComparison.OrdinalIgnoreCase));
        return Result<List<ChatPerson>>.Ok(people.OrderBy(p => p.Name, StringComparer.OrdinalIgnoreCase).ToList());
    }
}

// ── Online / last seen ──────────────────────────────────────────────────────
public sealed record PresenceDto(Guid UserId, bool Online, DateTimeOffset? LastSeenAt);

public sealed record GetPresenceQuery(List<Guid> UserIds) : IRequest<Result<List<PresenceDto>>>;

public sealed class GetPresenceHandler : IRequestHandler<GetPresenceQuery, Result<List<PresenceDto>>>
{
    private readonly ICurrentUser   _cu;
    private readonly IChatDirectory _dir;
    private readonly IChatPresence  _presence;
    public GetPresenceHandler(ICurrentUser cu, IChatDirectory dir, IChatPresence presence) => (_cu, _dir, _presence) = (cu, dir, presence);

    public async Task<Result<List<PresenceDto>>> Handle(GetPresenceQuery q, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId) return Result<List<PresenceDto>>.Fail("AUTH.REQUIRED", "Authentication context required.");

        // Only neighbours in the same society are shown.
        var inSociety = (await _dir.ListAsync(societyId, ct)).Select(p => p.UserId).ToHashSet();
        var result = new List<PresenceDto>();
        foreach (var id in q.UserIds.Distinct().Where(inSociety.Contains).Take(100))
        {
            var online = _presence.IsOnline(id);
            result.Add(new PresenceDto(id, online, online ? null : await _presence.LastSeenAsync(id, ct)));
        }
        return Result<List<PresenceDto>>.Ok(result);
    }
}

// ── Who is in a conversation ────────────────────────────────────────────────
public sealed record ChatMemberDto(Guid UserId, string Name, string Flat, bool IsAdmin, bool IsMe);

public sealed record GetConversationMembersQuery(Guid ConversationId) : IRequest<Result<List<ChatMemberDto>>>;

public sealed class GetConversationMembersHandler : IRequestHandler<GetConversationMembersQuery, Result<List<ChatMemberDto>>>
{
    private readonly CommunicationDbContext _db;
    private readonly ICurrentUser           _cu;
    private readonly IChatDirectory         _dir;
    public GetConversationMembersHandler(CommunicationDbContext db, ICurrentUser cu, IChatDirectory dir) => (_db, _cu, _dir) = (db, cu, dir);

    public async Task<Result<List<ChatMemberDto>>> Handle(GetConversationMembersQuery q, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId || _cu.UserId is not { } me)
            return Result<List<ChatMemberDto>>.Fail("AUTH.REQUIRED", "Authentication context required.");

        var conv = await _db.Conversations.AsNoTracking().FirstOrDefaultAsync(c => c.Id == q.ConversationId && c.SocietyId == societyId, ct);
        if (conv is null) return Result<List<ChatMemberDto>>.Fail("CHAT.NOT_FOUND", "Conversation not found.");
        var members = await _db.ConversationMembers.AsNoTracking().Where(m => m.ConversationId == conv.Id && m.LeftAt == null).ToListAsync(ct);
        if (members.All(m => m.UserId != me)) return Result<List<ChatMemberDto>>.Fail("FORBIDDEN", "You are not in this conversation.");

        var people = (await _dir.ListAsync(societyId, ct)).ToDictionary(p => p.UserId);
        return Result<List<ChatMemberDto>>.Ok(members
            .Select(m => people.TryGetValue(m.UserId, out var p)
                ? new ChatMemberDto(m.UserId, p.Name, p.Flat, m.IsAdmin, m.UserId == me)
                : new ChatMemberDto(m.UserId, "Former neighbour", string.Empty, m.IsAdmin, m.UserId == me))
            .OrderByDescending(x => x.IsAdmin).ThenBy(x => x.Name, StringComparer.OrdinalIgnoreCase).ToList());
    }
}
