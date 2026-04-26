using DigitalSocieties.Shared.Domain.Entities;
using DigitalSocieties.Identity.Domain.Events;

namespace DigitalSocieties.Identity.Domain.Entities;

/// <summary>
/// Binds a User to a Society with a specific role and optional flat.
/// This is the RBAC join table — one user can have multiple memberships
/// across different societies and roles. (SRP — membership only)
/// </summary>
public sealed class Membership : AuditableEntity
{
    private Membership() { }

    private Membership(Guid id, Guid userId, Guid societyId, string role, Guid? flatId, string memberType)
        : base(id)
    {
        UserId     = userId;
        SocietyId  = societyId;
        Role       = role;
        FlatId     = flatId;
        MemberType = memberType;
        IsActive   = true;
        JoinedAt   = DateTimeOffset.UtcNow;
    }

    public Guid   UserId     { get; private set; }
    public Guid   SocietyId  { get; private set; }
    public string Role       { get; private set; } = default!;       // from UserRole constants
    public Guid?  FlatId     { get; private set; }                   // null for guard/staff
    public string MemberType { get; private set; } = default!;       // owner / tenant / staff
    public bool   IsActive   { get; private set; }
    public DateTimeOffset JoinedAt   { get; private set; }
    public DateTimeOffset? ExpiresAt { get; private set; }           // for tenants

    // Navigation
    public User?    User    { get; private set; }
    public Society? Society { get; private set; }
    public Flat?    Flat    { get; private set; }

    public static Membership Create(Guid userId, Guid societyId, string role,
        Guid? flatId = null, string memberType = "owner")
    {
        var m = new Membership(Guid.NewGuid(), userId, societyId, role, flatId, memberType);
        m.Raise(new MembershipCreatedEvent(m.Id, userId, societyId, role));
        return m;
    }

    public void Revoke()
    {
        IsActive = false;
        Raise(new MembershipRevokedEvent(Id, UserId, SocietyId));
    }

    public void ChangeRole(string newRole)
    {
        Role = newRole;
        Raise(new MembershipRoleChangedEvent(Id, UserId, SocietyId, newRole));
    }
}
