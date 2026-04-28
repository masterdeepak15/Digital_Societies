using DigitalSocieties.Shared.Domain.Entities;
using DigitalSocieties.Shared.Domain.ValueObjects;
using DigitalSocieties.Identity.Domain.Events;

namespace DigitalSocieties.Identity.Domain.Entities;

/// <summary>
/// Global user — identified by phone number (OTP verified).
/// A user exists once globally; linked to societies via Membership.
/// (SRP — user knows about itself, not about societies)
/// </summary>
public sealed class User : AuditableEntity
{
    private User() { }

    private User(Guid id, string phone, string name)
        : base(id)
    {
        Phone      = phone;
        Name       = name;
        IsVerified = false;
        IsActive   = true;
    }

    public string  Phone       { get; private set; } = default!;
    public string  Name        { get; private set; } = default!;
    public string? Email       { get; private set; }
    public string? AvatarUrl   { get; private set; }
    public bool    IsVerified  { get; private set; }  // phone OTP verified
    public bool    IsActive    { get; private set; }
    public DateTimeOffset? LastLoginAt { get; private set; }

    // ── Two-Factor Authentication (TOTP / RFC 6238) ───────────────────────────
    // Pending2FaSecret holds the un-confirmed secret until Confirm2Fa succeeds.
    // TwoFactorSecret holds the active secret once 2FA is enabled.
    public bool    TwoFactorEnabled    { get; private set; }
    public string? TwoFactorSecret     { get; private set; }  // Base32, active
    public string? Pending2FaSecret    { get; private set; }  // Base32, awaiting confirmation

    // Device binding for security: new device = step-up verification required
    private readonly List<UserDevice> _devices = [];
    public IReadOnlyList<UserDevice>  Devices  => _devices.AsReadOnly();

    private readonly List<Membership> _memberships = [];
    public IReadOnlyList<Membership>  Memberships  => _memberships.AsReadOnly();

    public static User Create(PhoneNumber phone, string name)
    {
        var user = new User(Guid.NewGuid(), phone.Value, name);
        user.Raise(new UserCreatedEvent(user.Id, phone.Value));
        return user;
    }

    public void MarkVerified()
    {
        IsVerified = true;
        LastLoginAt = DateTimeOffset.UtcNow;
    }

    public void RecordLogin() => LastLoginAt = DateTimeOffset.UtcNow;

    public void RegisterDevice(string deviceId, string deviceName, string platform)
        => _devices.Add(UserDevice.Create(Id, deviceId, deviceName, platform));

    public bool HasDevice(string deviceId)
        => _devices.Any(d => d.DeviceId == deviceId && d.IsActive);

    public void Deactivate()
    {
        IsActive = false;
        Raise(new UserDeactivatedEvent(Id));
    }

    // ── 2FA domain methods ────────────────────────────────────────────────────
    public void SetPending2FaSecret(string secretBase32) => Pending2FaSecret = secretBase32;

    public void Activate2Fa()
    {
        TwoFactorSecret  = Pending2FaSecret;
        Pending2FaSecret = null;
        TwoFactorEnabled = true;
    }

    public void Disable2Fa()
    {
        TwoFactorEnabled = false;
        TwoFactorSecret  = null;
        Pending2FaSecret = null;
    }
}
