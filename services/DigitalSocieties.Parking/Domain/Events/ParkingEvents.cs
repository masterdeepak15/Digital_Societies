using DigitalSocieties.Shared.Domain.Events;

namespace DigitalSocieties.Parking.Domain.Events;

public sealed record SlotAssignedEvent(
    Guid SlotId, Guid SocietyId, Guid LevelId, Guid FlatId, string VehicleNumber)
    : DomainEvent;

public sealed record SlotUnassignedEvent(Guid SlotId, Guid SocietyId)
    : DomainEvent;

public sealed record VehicleRegisteredEvent(
    Guid VehicleId, Guid SocietyId, Guid FlatId, string RegistrationNumber)
    : DomainEvent;
