namespace DigitalSocieties.Visitor.Infrastructure.Hubs;

/// <summary>
/// ISP: focused interface for sending real-time push to specific group types.
/// Visitor module depends on this abstraction; SignalR hub implements it. (DIP)
/// </summary>
public interface ISocietyHubNotifier
{
    Task NotifyFlatAsync(Guid flatId, string eventName, object payload, CancellationToken ct);
    Task NotifySocietyGuardsAsync(Guid societyId, string eventName, object payload, CancellationToken ct);
    Task NotifySocietyAsync(Guid societyId, string eventName, object payload, CancellationToken ct);
}
