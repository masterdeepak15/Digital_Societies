using DigitalSocieties.Shared.Domain.Entities;

namespace DigitalSocieties.Social.Domain.Entities;

/// <summary>Admin moderation queue entry. Created when a resident reports a post.</summary>
public sealed class PostReport : Entity
{
    public Guid PostId              { get; set; }
    public Guid ReportedByUserId    { get; set; }
    public string Reason            { get; set; } = string.Empty;
    public string Status            { get; set; } = "pending"; // pending/reviewed/dismissed/actioned
    public DateTimeOffset CreatedAt { get; set; }
}
