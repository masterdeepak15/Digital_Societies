using DigitalSocieties.Shared.Domain.Events;

namespace DigitalSocieties.Billing.Domain.Events;

public sealed record BillCreatedEvent(Guid BillId, Guid SocietyId, Guid FlatId, string Period, long AmountPaise) : DomainEvent;
public sealed record BillPaidEvent(Guid BillId, Guid SocietyId, Guid FlatId, string PaymentId, long TotalPaise) : DomainEvent;
public sealed record BillOverdueEvent(Guid BillId, Guid SocietyId, Guid FlatId, long LateFee) : DomainEvent;
public sealed record BillWaivedEvent(Guid BillId, Guid SocietyId, Guid FlatId, string Reason) : DomainEvent;
public sealed record PaymentInitiatedEvent(Guid BillId, Guid PaymentId, string Gateway) : DomainEvent;
