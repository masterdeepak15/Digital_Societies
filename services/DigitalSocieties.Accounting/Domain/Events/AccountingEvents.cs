using DigitalSocieties.Shared.Domain.Events;

namespace DigitalSocieties.Accounting.Domain.Events;

public sealed record LedgerEntryPostedEvent(
    Guid EntryId, Guid SocietyId, string Type, string Category, long AmountPaise)
    : DomainEvent;

public sealed record LedgerEntryApprovedEvent(
    Guid EntryId, Guid SocietyId, Guid ApprovedBy, long AmountPaise)
    : DomainEvent;

public sealed record LedgerEntryRejectedEvent(
    Guid EntryId, Guid SocietyId, Guid RejectedBy, string Reason)
    : DomainEvent;
