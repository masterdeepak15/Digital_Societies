namespace DigitalSocieties.Communication.Application.Chat;

/// <summary>A neighbour as the chat shows them: name and flat only (never an email or a phone number).</summary>
public sealed record ChatPerson(Guid UserId, string Name, string Flat);

/// <summary>Who is in the society. Implemented over the Identity tables so the chat never depends on that module.</summary>
public interface IChatDirectory
{
    Task<IReadOnlyList<ChatPerson>> ListAsync(Guid societyId, CancellationToken ct);
}

public sealed record ChatMessageDto(
    Guid Id, Guid ConversationId, Guid SenderUserId, string SenderName, Guid ClientId, string Kind, string Body, string? MediaId,
    DateTimeOffset SentAt, bool IsMine, string Status);

/// <summary>Real-time and push delivery of chat events. The hub implements it; tests replace it.</summary>
public interface IChatNotifier
{
    /// <summary>A new message reached the server: push it to every other member (live if online, a notification if not).</summary>
    Task MessageSentAsync(Guid societyId, ChatMessageDto message, string conversationTitle, IReadOnlyList<Guid> recipients, CancellationToken ct);

    /// <summary>Someone received or read a conversation: tell the people who sent into it so their ticks update.</summary>
    Task ReceiptAsync(Guid conversationId, Guid userId, string state, DateTimeOffset at, IReadOnlyList<Guid> notify, CancellationToken ct);

    /// <summary>A person was added to a conversation: tell them so it appears in their list.</summary>
    Task ConversationChangedAsync(Guid conversationId, IReadOnlyList<Guid> members, CancellationToken ct);
}

/// <summary>Who is connected right now, and when they were last seen.</summary>
public interface IChatPresence
{
    bool IsOnline(Guid userId);
    Task<DateTimeOffset?> LastSeenAsync(Guid userId, CancellationToken ct);
}
