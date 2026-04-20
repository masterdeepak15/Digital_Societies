using DigitalSocieties.Shared.Domain.Entities;

namespace DigitalSocieties.Identity.Domain.Entities;

/// <summary>
/// Tracks registered devices for device-binding security check.
/// A new, unrecognized device triggers step-up verification.
/// </summary>
public sealed class UserDevice : Entity
{
    private UserDevice() { }

    private UserDevice(Guid id, Guid userId, string deviceId, string deviceName, string platform)
        : base(id)
    {
        UserId     = userId;
        DeviceId   = deviceId;   // UUID generated on mobile, stored in secure keystore
        DeviceName = deviceName;
        Platform   = platform;   // ios / android
        RegisteredAt = DateTimeOffset.UtcNow;
        IsActive   = true;
    }

    public Guid   UserId      { get; private set; }
    public string DeviceId    { get; private set; } = default!;
    public string DeviceName  { get; private set; } = default!;
    public string Platform    { get; private set; } = default!;
    public bool   IsActive    { get; private set; }
    public DateTimeOffset RegisteredAt { get; private set; }
    public DateTimeOffset? LastSeenAt  { get; private set; }

    public static UserDevice Create(Guid userId, string deviceId, string deviceName, string platform)
        => new(Guid.NewGuid(), userId, deviceId, deviceName, platform);

    public void UpdateLastSeen() => LastSeenAt = DateTimeOffset.UtcNow;
    public void Revoke()         => IsActive   = false;
}
