using DigitalSocieties.Shared.Domain.Entities;
using DigitalSocieties.Visitor.Domain.Events;

namespace DigitalSocieties.Visitor.Domain.Entities;

/// <summary>
/// Aggregate root: a single visitor entry at the gate.
/// Designed for offline-first — guard creates locally, syncs later.
/// State machine: Pending → Approved/Rejected → Entered → Exited.
/// </summary>
public sealed class Visitor : AuditableEntity
{
    private Visitor() { }

    private Visitor(Guid id, Guid societyId, Guid flatId, string name,
                    string? phone, string purpose, Guid guardId)
        : base(id)
    {
        SocietyId = societyId;
        FlatId    = flatId;
        Name      = name;
        Phone     = phone;
        Purpose   = purpose;
        GuardId   = guardId;
        Status    = VisitorStatus.Pending;
        EntryTime = DateTimeOffset.UtcNow;
    }

    public Guid            SocietyId      { get; private set; }
    public Guid            FlatId         { get; private set; }
    public string          Name           { get; private set; } = default!;
    public string?         Phone          { get; private set; }
    public string          Purpose        { get; private set; } = default!;
    public string?         VehicleNumber  { get; private set; }
    public string?         PhotoUrl       { get; private set; }
    public Guid            GuardId        { get; private set; }
    public VisitorStatus   Status         { get; private set; }
    public DateTimeOffset  EntryTime      { get; private set; }
    public DateTimeOffset? ExitTime       { get; private set; }
    public DateTimeOffset? ApprovedAt     { get; private set; }
    public Guid?           ApprovedBy     { get; private set; }
    public string?         RejectionReason { get; private set; }
    // QR token for boom-barrier / kiosk scan (signed JWT, 2-min TTL)
    public string?         QrToken        { get; private set; }

    public static Visitor Create(Guid societyId, Guid flatId, string name,
                                 string? phone, string purpose, Guid guardId)
    {
        var v = new Visitor(Guid.NewGuid(), societyId, flatId, name, phone, purpose, guardId);
        v.Raise(new VisitorAddedEvent(v.Id, societyId, flatId, name, purpose, guardId));
        return v;
    }

    public void Approve(Guid approvedBy, string? qrToken = null)
    {
        if (Status != VisitorStatus.Pending)
            throw new InvalidOperationException($"Cannot approve a visitor with status {Status}.");
        Status     = VisitorStatus.Approved;
        ApprovedAt = DateTimeOffset.UtcNow;
        ApprovedBy = approvedBy;
        QrToken    = qrToken;
        Raise(new VisitorApprovedEvent(Id, SocietyId, FlatId, approvedBy));
    }

    public void Reject(Guid rejectedBy, string reason)
    {
        if (Status != VisitorStatus.Pending)
            throw new InvalidOperationException($"Cannot reject a visitor with status {Status}.");
        Status          = VisitorStatus.Rejected;
        ApprovedBy      = rejectedBy;
        RejectionReason = reason;
        Raise(new VisitorRejectedEvent(Id, SocietyId, FlatId, rejectedBy, reason));
    }

    public void MarkEntered()
    {
        if (Status != VisitorStatus.Approved)
            throw new InvalidOperationException("Visitor must be approved before entering.");
        Status = VisitorStatus.Entered;
        Raise(new VisitorEnteredEvent(Id, SocietyId, EntryTime));
    }

    public void MarkExited()
    {
        ExitTime = DateTimeOffset.UtcNow;
        Status   = VisitorStatus.Exited;
        Raise(new VisitorExitedEvent(Id, SocietyId, ExitTime.Value));
    }

    public void AttachPhoto(string photoUrl) => PhotoUrl = photoUrl;
    public void SetVehicle(string plate)     => VehicleNumber = plate;
}

public enum VisitorStatus { Pending, Approved, Rejected, Entered, Exited }
