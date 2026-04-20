using DigitalSocieties.Shared.Domain.Events;

namespace DigitalSocieties.Communication.Domain.Events;

public sealed record NoticePostedEvent(Guid NoticeId, Guid SocietyId, string Type, string Title) : DomainEvent;
public sealed record EmergencyAlertSentEvent(Guid SocietyId, string Message, Guid SentBy) : DomainEvent;
