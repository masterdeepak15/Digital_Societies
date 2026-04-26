using DigitalSocieties.Shared.Domain.Entities;
using DigitalSocieties.Complaint.Domain.Events;

namespace DigitalSocieties.Complaint.Domain.Entities;

/// <summary>
/// Aggregate root: a resident complaint ticket.
/// State machine: Open → Assigned → InProgress → Resolved → Closed (or Reopened).
/// Images stored as MinIO URLs (IStorageProvider — OCP).
/// </summary>
public sealed class Complaint : AuditableEntity
{
    private Complaint() { }

    private Complaint(Guid id, Guid societyId, Guid flatId, Guid raisedBy,
                      string title, string description, string category, Priority priority)
        : base(id)
    {
        SocietyId   = societyId;
        FlatId      = flatId;
        RaisedBy    = raisedBy;
        Title       = title;
        Description = description;
        Category    = category;
        Priority    = priority;
        Status      = ComplaintStatus.Open;
    }

    public Guid             SocietyId   { get; private set; }
    public Guid             FlatId      { get; private set; }
    public Guid             RaisedBy    { get; private set; }
    public string           Title       { get; private set; } = default!;
    public string           Description { get; private set; } = default!;
    public string           Category    { get; private set; } = default!;
    public Priority         Priority    { get; private set; }
    public ComplaintStatus  Status      { get; private set; }
    public Guid?            AssignedTo  { get; private set; }
    public DateTimeOffset?  ResolvedAt  { get; private set; }
    public string?          Resolution  { get; private set; }

    private readonly List<string> _imageUrls = [];
    public IReadOnlyList<string>  ImageUrls  => _imageUrls.AsReadOnly();

    private readonly List<ComplaintUpdate> _updates = [];
    public IReadOnlyList<ComplaintUpdate>  Updates  => _updates.AsReadOnly();

    public static Complaint Create(Guid societyId, Guid flatId, Guid raisedBy,
                                   string title, string description, string category, Priority priority)
    {
        var c = new Complaint(Guid.NewGuid(), societyId, flatId, raisedBy,
                              title, description, category, priority);
        c.Raise(new ComplaintRaisedEvent(c.Id, societyId, flatId, raisedBy, category, priority.ToString()));
        return c;
    }

    public void AddImage(string url)  => _imageUrls.Add(url);

    public void Assign(Guid staffId, string? note = null)
    {
        AssignedTo = staffId;
        Status     = ComplaintStatus.Assigned;
        AddUpdate(staffId, ComplaintStatus.Assigned, note ?? "Complaint assigned.");
        Raise(new ComplaintAssignedEvent(Id, SocietyId, staffId));
    }

    public void StartWork(Guid by)
    {
        Status = ComplaintStatus.InProgress;
        AddUpdate(by, ComplaintStatus.InProgress, "Work started.");
    }

    public void Resolve(Guid by, string resolution)
    {
        Status     = ComplaintStatus.Resolved;
        Resolution = resolution;
        ResolvedAt = DateTimeOffset.UtcNow;
        AddUpdate(by, ComplaintStatus.Resolved, resolution);
        Raise(new ComplaintResolvedEvent(Id, SocietyId, FlatId, RaisedBy, resolution));
    }

    public void Close(Guid by)
    {
        Status = ComplaintStatus.Closed;
        AddUpdate(by, ComplaintStatus.Closed, "Complaint closed.");
    }

    public void Reopen(Guid by, string reason)
    {
        Status     = ComplaintStatus.Reopened;
        ResolvedAt = null;
        AddUpdate(by, ComplaintStatus.Reopened, $"Reopened: {reason}");
        Raise(new ComplaintReopenedEvent(Id, SocietyId, reason));
    }

    private void AddUpdate(Guid by, ComplaintStatus status, string comment)
        => _updates.Add(ComplaintUpdate.Create(Id, by, status, comment));
}

public sealed class ComplaintUpdate : Entity
{
    private ComplaintUpdate() { }
    private ComplaintUpdate(Guid id, Guid complaintId, Guid updatedBy, ComplaintStatus status, string comment)
        : base(id)
    { ComplaintId = complaintId; UpdatedBy = updatedBy; Status = status; Comment = comment; CreatedAt = DateTimeOffset.UtcNow; }

    public Guid            ComplaintId { get; private set; }
    public Guid            UpdatedBy   { get; private set; }
    public ComplaintStatus Status      { get; private set; }
    public string          Comment     { get; private set; } = default!;
    public DateTimeOffset  CreatedAt   { get; private set; }

    public static ComplaintUpdate Create(Guid complaintId, Guid updatedBy, ComplaintStatus status, string comment)
        => new(Guid.NewGuid(), complaintId, updatedBy, status, comment);
}

public enum ComplaintStatus { Open, Assigned, InProgress, Resolved, Closed, Reopened }
public enum Priority        { Low, Medium, High, Urgent }
