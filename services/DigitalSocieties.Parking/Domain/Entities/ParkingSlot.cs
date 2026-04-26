using DigitalSocieties.Shared.Domain.Entities;
using DigitalSocieties.Parking.Domain.Events;

namespace DigitalSocieties.Parking.Domain.Entities;

/// <summary>
/// A single numbered parking bay within a ParkingLevel.
/// Tracks assignment to a flat (permanent resident slot) or a visitor pass.
/// </summary>
public sealed class ParkingSlot : AuditableEntity
{
    private ParkingSlot() { }

    private ParkingSlot(Guid id, Guid societyId, Guid levelId,
        string slotNumber, SlotType type, bool isEvCharger)
        : base(id)
    {
        SocietyId  = societyId;
        LevelId    = levelId;
        SlotNumber = slotNumber;
        Type       = type;
        IsEvCharger = isEvCharger;
        Status     = SlotStatus.Available;
    }

    public Guid       SocietyId   { get; private set; }
    public Guid       LevelId     { get; private set; }
    public string     SlotNumber  { get; private set; } = default!;  // "B1-042"
    public SlotType   Type        { get; private set; }
    public SlotStatus Status      { get; private set; }
    public bool       IsEvCharger { get; private set; }

    // When assigned to a resident flat
    public Guid?   AssignedFlatId  { get; private set; }
    public string? VehicleNumber   { get; private set; }
    public string? VehicleType     { get; private set; }  // "Car" | "Bike" | "EV"

    // When used as a visitor pass
    public Guid?   VisitorPassId   { get; private set; }
    public DateTimeOffset? PassExpiresAt { get; private set; }

    // Navigation
    public ParkingLevel? Level { get; private set; }

    public static ParkingSlot Create(Guid societyId, Guid levelId,
        string slotNumber, SlotType type, bool isEvCharger = false)
        => new(Guid.NewGuid(), societyId, levelId, slotNumber, type, isEvCharger);

    // ── Assignment lifecycle ───────────────────────────────────────────────
    public void AssignToFlat(Guid flatId, string vehicleNumber, string vehicleType)
    {
        if (Status == SlotStatus.AssignedResident)
            throw new InvalidOperationException("Slot is already assigned to a resident.");
        Status          = SlotStatus.AssignedResident;
        AssignedFlatId  = flatId;
        VehicleNumber   = vehicleNumber.ToUpperInvariant();
        VehicleType     = vehicleType;
        VisitorPassId   = null;
        PassExpiresAt   = null;
        Raise(new SlotAssignedEvent(Id, SocietyId, levelId: LevelId, flatId, vehicleNumber));
    }

    public void Unassign()
    {
        Status          = SlotStatus.Available;
        AssignedFlatId  = null;
        VehicleNumber   = null;
        VehicleType     = null;
        Raise(new SlotUnassignedEvent(Id, SocietyId));
    }

    public void IssueVisitorPass(Guid passId, DateTimeOffset expiresAt)
    {
        if (Status == SlotStatus.AssignedResident)
            throw new InvalidOperationException("Cannot use a resident slot as visitor pass.");
        Status        = SlotStatus.VisitorPass;
        VisitorPassId = passId;
        PassExpiresAt = expiresAt;
    }

    public void ReleaseVisitorPass()
    {
        Status        = SlotStatus.Available;
        VisitorPassId = null;
        PassExpiresAt = null;
    }

    public void MarkMaintenance() => Status = SlotStatus.Maintenance;
    public void MarkAvailable()   => Status = SlotStatus.Available;
}

public enum SlotType   { Car, Bike, Heavy }
public enum SlotStatus { Available, AssignedResident, VisitorPass, Maintenance }
