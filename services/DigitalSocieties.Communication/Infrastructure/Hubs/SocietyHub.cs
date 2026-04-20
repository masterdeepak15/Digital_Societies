using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Visitor.Infrastructure.Hubs;

namespace DigitalSocieties.Communication.Infrastructure.Hubs;

/// <summary>
/// SignalR hub — real-time push for the entire society platform.
/// Groups: "flat_{flatId}", "guards_{societyId}", "society_{societyId}"
///
/// Implements ISocietyHubNotifier (from Visitor module) — DIP + LSP.
/// Registered as the concrete implementation of ISocietyHubNotifier in API host.
/// </summary>
[Authorize]
public sealed class SocietyHub : Hub
{
    private readonly ICurrentUser _currentUser;

    public SocietyHub(ICurrentUser currentUser) => _currentUser = currentUser;

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

        await base.OnConnectedAsync();
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
