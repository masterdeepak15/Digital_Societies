using DigitalSocieties.Shared.Domain.Entities;

namespace DigitalSocieties.Calling.Domain.Entities;

/// <summary>
/// Represents a scheduled or active video/audio call room.
/// Aggregate root — governs its own participant lifecycle.
/// </summary>
public sealed class CallRoom : AuditableEntity
{
    public new Guid          Id             { get; private set; } = Guid.NewGuid();
    public Guid              SocietyId      { get; private set; }
    public string            RoomName       { get; private set; } = string.Empty;
    public CallRoomType      Type           { get; private set; }
    public CallRoomStatus    Status         { get; private set; }
    public DateTimeOffset    ExpiresAt      { get; private set; }

    /// <summary>
    /// For Visitor callbacks: the Visitor entity that triggered the call.
    /// Null for SOS and ad-hoc rooms.
    /// </summary>
    public Guid? LinkedVisitorId { get; private set; }

    /// <summary>
    /// Flat that initiated the SOS. Null for non-SOS rooms.
    /// </summary>
    public Guid? InitiatorFlatId { get; private set; }

    // EF navigation
    public IReadOnlyCollection<CallParticipant> Participants => _participants.AsReadOnly();
    private readonly List<CallParticipant> _participants = [];

    private CallRoom() { }

    public static CallRoom Create(
        Guid          societyId,
        CallRoomType  type,
        TimeSpan?     ttl             = null,
        Guid?         linkedVisitorId = null,
        Guid?         initiatorFlatId = null)
    {
        var expiry = DateTimeOffset.UtcNow + (ttl ?? TimeSpan.FromMinutes(30));
        return new CallRoom
        {
            SocietyId       = societyId,
            RoomName        = $"ds-{type.ToString().ToLower()}-{Guid.NewGuid():N}",
            Type            = type,
            Status          = CallRoomStatus.Waiting,
            ExpiresAt       = expiry,
            LinkedVisitorId = linkedVisitorId,
            InitiatorFlatId = initiatorFlatId,
        };
    }

    public void AddParticipant(Guid userId, string displayName, CallRole role)
    {
        if (_participants.Any(p => p.UserId == userId)) return; // idempotent
        _participants.Add(CallParticipant.Create(Id, userId, displayName, role));
    }

    public void MarkActive()  => Status = CallRoomStatus.Active;
    public void MarkEnded()   => Status = CallRoomStatus.Ended;
    public bool IsExpired()   => DateTimeOffset.UtcNow >= ExpiresAt;
}

public sealed class CallParticipant
{
    public Guid     Id          { get; private set; } = Guid.NewGuid();
    public Guid     RoomId      { get; private set; }
    public Guid     UserId      { get; private set; }
    public string   DisplayName { get; private set; } = string.Empty;
    public CallRole Role        { get; private set; }
    public DateTimeOffset JoinedAt { get; private set; }

    private CallParticipant() { }

    internal static CallParticipant Create(Guid roomId, Guid userId, string name, CallRole role) =>
        new() { RoomId = roomId, UserId = userId, DisplayName = name, Role = role, JoinedAt = DateTimeOffset.UtcNow };
}

public enum CallRoomType   { VisitorCallback, Sos, AdHoc }
public enum CallRoomStatus { Waiting, Active, Ended, Expired }
public enum CallRole       { Host, Participant, Observer }
