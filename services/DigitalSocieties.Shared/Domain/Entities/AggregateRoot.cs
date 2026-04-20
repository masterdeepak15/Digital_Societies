using DigitalSocieties.Shared.Domain.Events;

namespace DigitalSocieties.Shared.Domain.Entities;

/// <summary>
/// Aggregate root — owns a collection of domain events to be dispatched
/// after the transaction commits. (SRP — one reason to change: event publishing)
/// </summary>
public abstract class AggregateRoot : Entity
{
    protected AggregateRoot() { }
    protected AggregateRoot(Guid id) : base(id) { }

    private readonly List<IDomainEvent> _domainEvents = [];
    public IReadOnlyList<IDomainEvent> DomainEvents => _domainEvents.AsReadOnly();

    protected void Raise(IDomainEvent domainEvent) => _domainEvents.Add(domainEvent);
    public void ClearDomainEvents()                => _domainEvents.Clear();
}
