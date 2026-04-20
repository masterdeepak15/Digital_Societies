using DigitalSocieties.Shared.Domain.Events;

namespace DigitalSocieties.Identity.Domain.Events;

public sealed record UserCreatedEvent(Guid UserId, string Phone) : DomainEvent;
public sealed record UserDeactivatedEvent(Guid UserId) : DomainEvent;
public sealed record SocietyCreatedEvent(Guid SocietyId, string Name) : DomainEvent;
public sealed record SocietyTierChangedEvent(Guid SocietyId, string NewTier) : DomainEvent;
public sealed record SocietyDeactivatedEvent(Guid SocietyId) : DomainEvent;
public sealed record MembershipCreatedEvent(Guid MembershipId, Guid UserId, Guid SocietyId, string Role) : DomainEvent;
public sealed record MembershipRevokedEvent(Guid MembershipId, Guid UserId, Guid SocietyId) : DomainEvent;
public sealed record MembershipRoleChangedEvent(Guid MembershipId, Guid UserId, Guid SocietyId, string NewRole) : DomainEvent;
public sealed record OtpVerifiedEvent(string Phone, string Purpose, string? DeviceId) : DomainEvent;
