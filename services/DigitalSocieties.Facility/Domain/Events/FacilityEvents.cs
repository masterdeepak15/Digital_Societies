using DigitalSocieties.Shared.Domain.Events;

namespace DigitalSocieties.Facility.Domain.Events;

public sealed record FacilityBookedEvent(
    Guid BookingId, Guid FacilityId, Guid SocietyId, Guid FlatId, DateOnly BookingDate)
    : DomainEvent;

public sealed record FacilityBookingCancelledEvent(
    Guid BookingId, Guid FacilityId, Guid SocietyId, Guid FlatId)
    : DomainEvent;
