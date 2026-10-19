using DigitalSocieties.Shared.Domain.Entities;

namespace DigitalSocieties.Communication.Domain.Entities;

public enum ConversationType { Direct, Group }

public enum ChatMessageKind { Text, Image }

/// <summary>A one-to-one chat or a group of neighbours. Messages are private to its members (admins do not read them).</summary>
public sealed class Conversation : AuditableEntity
{
    public const int MaxGroupMembers = 200;

    public new Guid  Id        { get; private set; } = Guid.NewGuid();
    public Guid      SocietyId { get; private set; }
    public ConversationType Type { get; private set; }
    /// <summary>Group name; empty for a one-to-one chat (each person sees the other's name).</summary>
    public string    Title     { get; private set; } = string.Empty;
    /// <summary>"smaller-id:larger-id" for a one-to-one chat, so a pair of people has exactly one chat.</summary>
    public string?   DirectKey { get; private set; }
    public Guid      CreatedByUserId { get; private set; }

    public DateTimeOffset? LastMessageAt      { get; private set; }
    public string          LastMessagePreview { get; private set; } = string.Empty;
    public Guid?           LastMessageSenderId { get; private set; }

    private Conversation() { }

    public static string KeyOf(Guid a, Guid b) =>
        a.CompareTo(b) <= 0 ? $"{a:N}:{b:N}" : $"{b:N}:{a:N}";

    public static Conversation Direct(Guid societyId, Guid creator, Guid other) => new()
    {
        SocietyId = societyId, Type = ConversationType.Direct, DirectKey = KeyOf(creator, other), CreatedByUserId = creator,
        CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow,
    };

    public static Conversation Group(Guid societyId, Guid creator, string title) => new()
    {
        SocietyId = societyId, Type = ConversationType.Group, Title = title.Trim(), CreatedByUserId = creator,
        CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow,
    };

    public void Rename(string title) => Title = title.Trim();

    public void NoteMessage(ChatMessage m)
    {
        LastMessageAt       = m.SentAt;
        LastMessageSenderId = m.SenderUserId;
        LastMessagePreview  = m.Kind == ChatMessageKind.Image
            ? (string.IsNullOrWhiteSpace(m.Body) ? "📷 Photo" : $"📷 {Trim(m.Body)}")
            : Trim(m.Body);
    }

    private static string Trim(string s) { s = s.Trim(); return s.Length <= 120 ? s : s[..120]; }
}

/// <summary>One person in a conversation, with how far they have received and read it (this drives the ticks).</summary>
public sealed class ConversationMember : AuditableEntity
{
    public new Guid Id            { get; private set; } = Guid.NewGuid();
    public Guid     ConversationId { get; private set; }
    public Guid     UserId         { get; private set; }
    public bool     IsAdmin        { get; private set; }
    public DateTimeOffset JoinedAt { get; private set; }
    public DateTimeOffset? LeftAt  { get; private set; }
    public DateTimeOffset? LastDeliveredAt { get; private set; }
    public DateTimeOffset? LastReadAt      { get; private set; }

    public bool IsActive => LeftAt is null;

    private ConversationMember() { }

    public static ConversationMember Join(Guid conversationId, Guid userId, bool isAdmin) => new()
    {
        ConversationId = conversationId, UserId = userId, IsAdmin = isAdmin, JoinedAt = DateTimeOffset.UtcNow,
        CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow,
    };

    public void Leave() => LeftAt = DateTimeOffset.UtcNow;
    public void Rejoin() { LeftAt = null; JoinedAt = DateTimeOffset.UtcNow; }
    public void MakeAdmin(bool admin) => IsAdmin = admin;

    /// <summary>Never moves backwards, so a late acknowledgement cannot undo a read tick.</summary>
    public void Delivered(DateTimeOffset at)
    {
        if (LastDeliveredAt is null || at > LastDeliveredAt) LastDeliveredAt = at;
    }

    public void Read(DateTimeOffset at)
    {
        if (LastReadAt is null || at > LastReadAt) LastReadAt = at;
        Delivered(at);
    }
}

public sealed class ChatMessage : AuditableEntity
{
    public const int MaxBody = 4000;

    public new Guid Id            { get; private set; } = Guid.NewGuid();
    public Guid     SocietyId      { get; private set; }
    public Guid     ConversationId { get; private set; }
    public Guid     SenderUserId   { get; private set; }
    /// <summary>Chosen by the sender's phone, so a message that is retried after a bad connection is stored once.</summary>
    public Guid     ClientId       { get; private set; }
    public ChatMessageKind Kind    { get; private set; }
    public string   Body           { get; private set; } = string.Empty;
    /// <summary>The stored picture (media store id) for an image message.</summary>
    public string?  MediaId        { get; private set; }
    public DateTimeOffset SentAt   { get; private set; }

    private ChatMessage() { }

    public static ChatMessage Create(Guid societyId, Guid conversationId, Guid sender, Guid clientId, ChatMessageKind kind, string body, string? mediaId) => new()
    {
        SocietyId = societyId, ConversationId = conversationId, SenderUserId = sender, ClientId = clientId,
        Kind = kind, Body = body.Trim(), MediaId = kind == ChatMessageKind.Image ? mediaId : null,
        SentAt = DateTimeOffset.UtcNow, CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow,
    };
}

/// <summary>When someone was last on the app (shown as "last seen" once they are offline).</summary>
public sealed class UserPresence
{
    public Guid UserId { get; set; }
    public DateTimeOffset LastSeenAt { get; set; }
}
