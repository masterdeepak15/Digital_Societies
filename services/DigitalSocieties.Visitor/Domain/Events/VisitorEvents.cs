using DigitalSocieties.Shared.Domain.Events;

namespace DigitalSocieties.Visitor.Domain.Events;

public sealed record VisitorAddedEvent(Guid VisitorId, Guid SocietyId, Guid FlatId, string Name, string Purpose, Guid GuardId) : DomainEvent;
public sealed record VisitorApprovedEvent(Guid VisitorId, Guid SocietyId, Guid FlatId, Guid ApprovedBy) : DomainEvent;
public sealed record VisitorRejectedEvent(Guid VisitorId, Guid SocietyId, Guid FlatId, Guid RejectedBy, string Reason) : DomainEvent;
public sealed record VisitorEnteredEvent(Guid VisitorId, Guid SocietyId, DateTimeOffset EntryTime) : DomainEvent;
public sealed record VisitorExitedEvent(Guid VisitorId, Guid SocietyId, DateTimeOffset ExitTime) : DomainEvent;
