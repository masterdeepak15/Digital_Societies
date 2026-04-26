using DigitalSocieties.Shared.Domain.Events;

namespace DigitalSocieties.Complaint.Domain.Events;

public sealed record ComplaintRaisedEvent(Guid ComplaintId, Guid SocietyId, Guid FlatId, Guid RaisedBy, string Category, string Priority) : DomainEvent;
public sealed record ComplaintAssignedEvent(Guid ComplaintId, Guid SocietyId, Guid AssignedTo) : DomainEvent;
public sealed record ComplaintResolvedEvent(Guid ComplaintId, Guid SocietyId, Guid FlatId, Guid RaisedBy, string Resolution) : DomainEvent;
public sealed record ComplaintReopenedEvent(Guid ComplaintId, Guid SocietyId, string Reason) : DomainEvent;
