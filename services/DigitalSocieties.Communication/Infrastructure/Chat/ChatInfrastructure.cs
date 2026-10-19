using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Domain;
using DigitalSocieties.Communication.Application.Chat;
using DigitalSocieties.Communication.Infrastructure.Hubs;
using DigitalSocieties.Communication.Infrastructure.Persistence;

namespace DigitalSocieties.Communication.Infrastructure.Chat;

/// <summary>
/// The people of a society for chat, read straight from the Identity tables (a cross-schema query, the same way
/// Billing reads flats) so the chat module does not depend on the Identity module. Only name and flat leave here.
/// </summary>
internal sealed class PostgresChatDirectory : IChatDirectory
{
    private readonly CommunicationDbContext _db;
    public PostgresChatDirectory(CommunicationDbContext db) => _db = db;

    public async Task<IReadOnlyList<ChatPerson>> ListAsync(Guid societyId, CancellationToken ct)
    {
        var rows = await _db.Database.SqlQueryRaw<PersonRow>(
            "SELECT u.\"Id\" AS \"UserId\", u.\"Name\" AS \"Name\", COALESCE(f.\"Wing\", '') AS \"Wing\", COALESCE(f.\"Number\", '') AS \"Number\" " +
            "FROM identity.users u " +
            "JOIN identity.memberships m ON m.\"UserId\" = u.\"Id\" AND m.\"SocietyId\" = {0} AND m.\"IsActive\" AND NOT m.\"IsDeleted\" " +
            "     AND (m.\"ExpiresAt\" IS NULL OR m.\"ExpiresAt\" > now()) " +
            "LEFT JOIN identity.\"Flats\" f ON f.\"Id\" = m.\"FlatId\" AND NOT f.\"IsDeleted\" " +
            "WHERE NOT u.\"IsDeleted\" AND u.\"IsActive\"", societyId).ToListAsync(ct);

        // A person can hold several roles; show them once, with their flat if they have one.
        return rows.GroupBy(r => r.UserId).Select(g =>
        {
            var withFlat = g.FirstOrDefault(r => r.Number != "");
            var flat = withFlat is null ? "Management" : FlatLabel.Of(withFlat.Wing, withFlat.Number);
            var name = string.IsNullOrWhiteSpace(g.First().Name) ? flat : g.First().Name;
            return new ChatPerson(g.Key, name, flat);
        }).ToList();
    }

    private sealed record PersonRow(Guid UserId, string Name, string Wing, string Number);
}

/// <summary>Who has the app open right now. One person can have several connections (phone and browser).</summary>
public sealed class PresenceTracker
{
    private readonly ConcurrentDictionary<Guid, int> _connections = new();

    /// <summary>True when this is the person's first connection (they just came online).</summary>
    public bool Connected(Guid userId) => _connections.AddOrUpdate(userId, 1, (_, n) => n + 1) == 1;

    /// <summary>True when that was their last connection (they just went offline).</summary>
    public bool Disconnected(Guid userId)
    {
        var left = _connections.AddOrUpdate(userId, 0, (_, n) => Math.Max(0, n - 1));
        if (left > 0) return false;
        _connections.TryRemove(new KeyValuePair<Guid, int>(userId, 0));
        return true;
    }

    public bool IsOnline(Guid userId) => _connections.TryGetValue(userId, out var n) && n > 0;
}

internal sealed class ChatPresence : IChatPresence
{
    private readonly PresenceTracker _tracker;
    private readonly CommunicationDbContext _db;
    public ChatPresence(PresenceTracker tracker, CommunicationDbContext db) => (_tracker, _db) = (tracker, db);

    public bool IsOnline(Guid userId) => _tracker.IsOnline(userId);

    public async Task<DateTimeOffset?> LastSeenAsync(Guid userId, CancellationToken ct)
        => await _db.UserPresences.AsNoTracking().Where(p => p.UserId == userId).Select(p => (DateTimeOffset?)p.LastSeenAt).FirstOrDefaultAsync(ct);
}

/// <summary>Pushes chat events to each person's own SignalR group, and sends a notification to anyone who is not online.</summary>
internal sealed class ChatNotifier : IChatNotifier
{
    private readonly IHubContext<SocietyHub> _hub;
    private readonly PresenceTracker _tracker;
    private readonly INotificationDispatcher _dispatcher;
    private readonly ILogger<ChatNotifier> _log;

    public ChatNotifier(IHubContext<SocietyHub> hub, PresenceTracker tracker, INotificationDispatcher dispatcher, ILogger<ChatNotifier> log)
        => (_hub, _tracker, _dispatcher, _log) = (hub, tracker, dispatcher, log);

    public static string GroupOf(Guid userId) => $"user_{userId}";

    public async Task MessageSentAsync(Guid societyId, ChatMessageDto message, string conversationTitle, IReadOnlyList<Guid> recipients, CancellationToken ct)
    {
        foreach (var r in recipients)
        {
            await _hub.Clients.Group(GroupOf(r)).SendAsync("ChatMessage", message, ct);
            if (_tracker.IsOnline(r)) continue;
            try
            {
                var preview = message.Kind == "Image" ? (string.IsNullOrWhiteSpace(message.Body) ? "📷 Photo" : $"📷 {message.Body}") : message.Body;
                await _dispatcher.DispatchAsync(new NotificationMessage(r.ToString(), conversationTitle,
                    conversationTitle == message.SenderName ? preview : $"{message.SenderName}: {preview}", null,
                    new Dictionary<string, string> { ["type"] = "chat", ["channelId"] = "chat", ["conversationId"] = message.ConversationId.ToString() }), null, ct);
            }
            catch (Exception e) { _log.LogWarning(e, "[Chat] push to {User} failed", r); }   // a failed notification never fails the send
        }
    }

    public async Task ReceiptAsync(Guid conversationId, Guid userId, string state, DateTimeOffset at, IReadOnlyList<Guid> notify, CancellationToken ct)
    {
        foreach (var n in notify)
            await _hub.Clients.Group(GroupOf(n)).SendAsync("ChatReceipt", new { conversationId, userId, state, at }, ct);
    }

    public async Task ConversationChangedAsync(Guid conversationId, IReadOnlyList<Guid> members, CancellationToken ct)
    {
        foreach (var m in members)
            await _hub.Clients.Group(GroupOf(m)).SendAsync("ChatConversation", new { conversationId }, ct);
    }
}
