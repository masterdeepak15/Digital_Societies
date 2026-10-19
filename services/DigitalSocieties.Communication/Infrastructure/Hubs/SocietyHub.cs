using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using DigitalSocieties.Shared.Contracts;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Visitor.Infrastructure.Hubs;
using DigitalSocieties.Communication.Domain.Entities;
using DigitalSocieties.Communication.Infrastructure.Chat;
using DigitalSocieties.Communication.Infrastructure.Persistence;

namespace DigitalSocieties.Communication.Infrastructure.Hubs;

/// <summary>
/// SignalR hub — real-time push for the entire society platform.
/// Groups: "flat_{flatId}", "guards_{societyId}", "society_{societyId}", "user_{userId}" (chat, one per person)
///
/// Implements ISocietyHubNotifier (from Visitor module) — DIP + LSP.
/// Registered as the concrete implementation of ISocietyHubNotifier in API host.
/// </summary>
[Authorize]
public sealed class SocietyHub : Hub
{
    private readonly ICurrentUser _currentUser;
    private readonly PresenceTracker _presence;
    private readonly CommunicationDbContext _db;

    public SocietyHub(ICurrentUser currentUser, PresenceTracker presence, CommunicationDbContext db)
        => (_currentUser, _presence, _db) = (currentUser, presence, db);

    public override async Task OnConnectedAsync()
    {
        if (!_currentUser.IsAuthenticated) { Context.Abort(); return; }

        var societyId = _currentUser.SocietyId;
        var flatId    = _currentUser.FlatId;
        var roles     = _currentUser.Roles;

        // Join role-appropriate groups
        if (societyId.HasValue)
            await Groups.AddToGroupAsync(Context.ConnectionId, $"society_{societyId}");

        if (flatId.HasValue)
            await Groups.AddToGroupAsync(Context.ConnectionId, $"flat_{flatId}");

        if (roles.Contains("guard") && societyId.HasValue)
            await Groups.AddToGroupAsync(Context.ConnectionId, $"guards_{societyId}");

        if (roles.Contains("admin") && societyId.HasValue)
            await Groups.AddToGroupAsync(Context.ConnectionId, $"admins_{societyId}");

        // Chat: each person has their own group, and everyone in the society hears when they come online.
        if (_currentUser.UserId is { } userId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, ChatNotifier.GroupOf(userId));
            if (_presence.Connected(userId) && societyId.HasValue)
                await Clients.Group($"society_{societyId}").SendAsync("Presence", new { userId, online = true, lastSeenAt = (DateTimeOffset?)null });
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (_currentUser.UserId is { } userId && _presence.Disconnected(userId))
        {
            var now = DateTimeOffset.UtcNow;
            try
            {
                var row = await _db.UserPresences.FirstOrDefaultAsync(p => p.UserId == userId);
                if (row is null) _db.UserPresences.Add(new UserPresence { UserId = userId, LastSeenAt = now });
                else row.LastSeenAt = now;
                await _db.SaveChangesAsync();
            }
            catch { /* last-seen is a nicety: never let it break a disconnect */ }

            if (_currentUser.SocietyId is { } societyId)
                await Clients.Group($"society_{societyId}").SendAsync("Presence", new { userId, online = false, lastSeenAt = (DateTimeOffset?)now });
        }
        await base.OnDisconnectedAsync(exception);
    }
}

/// <summary>
/// Concrete ISocietyHubNotifier — uses IHubContext to push from outside the hub. (SRP)
/// </summary>
public sealed class SignalRHubNotifier : ISocietyHubNotifier
{
    private readonly IHubContext<SocietyHub> _hub;

    public SignalRHubNotifier(IHubContext<SocietyHub> hub) => _hub = hub;

    public Task NotifyFlatAsync(Guid flatId, string eventName, object payload, CancellationToken ct)
        => _hub.Clients.Group($"flat_{flatId}").SendAsync(eventName, payload, ct);

    public Task NotifySocietyGuardsAsync(Guid societyId, string eventName, object payload, CancellationToken ct)
        => _hub.Clients.Group($"guards_{societyId}").SendAsync(eventName, payload, ct);

    public Task NotifySocietyAsync(Guid societyId, string eventName, object payload, CancellationToken ct)
        => _hub.Clients.Group($"society_{societyId}").SendAsync(eventName, payload, ct);
}
