using DigitalSocieties.Shared.Domain.Entities;
using DigitalSocieties.Communication.Domain.Events;

namespace DigitalSocieties.Communication.Domain.Entities;

public sealed class Notice : AuditableEntity
{
    private Notice() { }
    private Notice(Guid id, Guid societyId, Guid postedBy, string title,
                   string body, NoticeType type, DateTimeOffset? expiresAt)
        : base(id)
    {
        SocietyId = societyId; PostedBy  = postedBy;
        Title     = title;     Body      = body;
        Type      = type;      ExpiresAt = expiresAt;
        IsPinned  = false;
    }

    public Guid           SocietyId { get; private set; }
    public Guid           PostedBy  { get; private set; }
    public string         Title     { get; private set; } = default!;
    public string         Body      { get; private set; } = default!;
    public NoticeType     Type      { get; private set; }
    public bool           IsPinned  { get; private set; }
    public DateTimeOffset? ExpiresAt { get; private set; }

    public static Notice Create(Guid societyId, Guid postedBy, string title,
                                string body, NoticeType type, DateTimeOffset? expiresAt = null)
    {
        var n = new Notice(Guid.NewGuid(), societyId, postedBy, title, body, type, expiresAt);
        n.Raise(new NoticePostedEvent(n.Id, societyId, type.ToString(), title));
        return n;
    }

    public void Pin()   => IsPinned = true;
    public void Unpin() => IsPinned = false;
    public void Expire() => SoftDelete();
}

public enum NoticeType { Notice, Emergency, Event, Circular }
