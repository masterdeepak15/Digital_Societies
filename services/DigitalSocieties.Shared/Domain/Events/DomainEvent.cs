namespace DigitalSocieties.Shared.Domain.Events;

public abstract record DomainEvent : IDomainEvent
{
    protected DomainEvent()
    {
        EventId    = Guid.NewGuid();
        OccurredAt = DateTimeOffset.UtcNow;
        EventType  = GetType().Name;
    }
    public Guid           EventId    { get; }
    public string         EventType  { get; }
    public DateTimeOffset OccurredAt { get; }
}
