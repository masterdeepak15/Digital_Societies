using MediatR;

namespace DigitalSocieties.Shared.Domain.Events;

/// <summary>
/// Marker interface for domain events. Extends MediatR INotification so
/// handlers are registered automatically. (OCP — new events without modifying dispatcher)
/// </summary>
public interface IDomainEvent : INotification
{
    Guid   EventId   { get; }
    string EventType { get; }
    DateTimeOffset OccurredAt { get; }
}
