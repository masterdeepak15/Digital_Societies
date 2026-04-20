using DigitalSocieties.Shared.Domain.Entities;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Social.Domain.Enums;
using DigitalSocieties.Social.Domain.Events;

namespace DigitalSocieties.Social.Domain.Entities;

/// <summary>
/// Aggregate root for the Society Feed.
/// A post is the central entity — comments, reactions, marketplace listings,
/// and polls are child objects that live inside or alongside it.
///
/// SOLID notes:
///   S — owns only feed-post behaviour; marketplace/poll details are separate entities
///   O — new post categories don't require changes here; PostCategory is a constants set
///   L — all state transitions return Result<T> so callers handle failure
/// </summary>
public sealed class SocialPost : AggregateRoot
{
    // ── Identity ───────────────────────────────────────────────────────────────
    public Guid SocietyId      { get; private set; }
    public Guid AuthorUserId   { get; private set; }
    public Guid AuthorFlatId   { get; private set; }
    public Guid? GroupId       { get; private set; }

    // ── Content ───────────────────────────────────────────────────────────────
    public string Category     { get; private set; } = PostCategory.General;
    public string Body         { get; private set; } = string.Empty;
    public List<string> ImageUrls { get; private set; } = [];

    // ── State ─────────────────────────────────────────────────────────────────
    public bool IsPinned       { get; private set; }
    public bool IsLocked       { get; private set; }   // comments disabled
    public bool IsDeleted      { get; private set; }
    public DateTimeOffset? ExpiresAt { get; private set; }

    // ── Audit ─────────────────────────────────────────────────────────────────
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    // ── Children (EF navigation — not collections; ISP: use dedicated queries) ─
    public ICollection<PostComment>  Comments  { get; private set; } = [];
    public ICollection<PostReaction> Reactions { get; private set; } = [];

    // ── EF constructor ────────────────────────────────────────────────────────
    private SocialPost() { }

    // ── Factory ───────────────────────────────────────────────────────────────
    public static Result<SocialPost> Create(
        Guid societyId,
        Guid authorUserId,
        Guid authorFlatId,
        string category,
        string body,
        Guid? groupId = null,
        List<string>? imageUrls = null)
    {
        if (!PostCategory.All.Contains(category))
            return Result<SocialPost>.Fail(new Error("Post.InvalidCategory",
                $"Category '{category}' is not valid."));

        if (string.IsNullOrWhiteSpace(body) || body.Length > 1000)
            return Result<SocialPost>.Fail(new Error("Post.InvalidBody",
                "Post body must be between 1 and 1000 characters."));

        var now = DateTimeOffset.UtcNow;

        // HelpWanted auto-expires in 24h
        DateTimeOffset? expiresAt = PostCategory.AutoExpiring.Contains(category)
            ? now.AddHours(24)
            : null;

        var post = new SocialPost
        {
            Id            = Guid.NewGuid(),
            SocietyId     = societyId,
            AuthorUserId  = authorUserId,
            AuthorFlatId  = authorFlatId,
            Category      = category,
            Body          = body.Trim(),
            GroupId       = groupId,
            ImageUrls     = imageUrls ?? [],
            ExpiresAt     = expiresAt,
            CreatedAt     = now,
            UpdatedAt     = now,
        };

        post.Raise(new PostCreatedEvent(post.Id, societyId, authorUserId, category, groupId));
        return Result<SocialPost>.Ok(post);
    }

    // ── Commands ──────────────────────────────────────────────────────────────

    public Result<bool> AddImage(string imageUrl)
    {
        if (ImageUrls.Count >= 4)
            return Result<bool>.Fail(new Error("Post.TooManyImages", "Maximum 4 images per post."));
        ImageUrls.Add(imageUrl);
        UpdatedAt = DateTimeOffset.UtcNow;
        return Result<bool>.Ok(true);
    }

    public Result<bool> Pin()
    {
        IsPinned  = true;
        UpdatedAt = DateTimeOffset.UtcNow;
        return Result<bool>.Ok(true);
    }

    public Result<bool> Unpin()
    {
        IsPinned  = false;
        UpdatedAt = DateTimeOffset.UtcNow;
        return Result<bool>.Ok(true);
    }

    public Result<bool> LockComments()
    {
        IsLocked  = true;
        UpdatedAt = DateTimeOffset.UtcNow;
        return Result<bool>.Ok(true);
    }

    public Result<bool> UnlockComments()
    {
        IsLocked  = false;
        UpdatedAt = DateTimeOffset.UtcNow;
        return Result<bool>.Ok(true);
    }

    public Result<bool> SoftDelete(Guid deletedByUserId)
    {
        IsDeleted = true;
        UpdatedAt = DateTimeOffset.UtcNow;
        Raise(new PostDeletedEvent(Id, SocietyId, deletedByUserId));
        return Result<bool>.Ok(true);
    }

    public bool IsExpired() =>
        ExpiresAt.HasValue && ExpiresAt.Value < DateTimeOffset.UtcNow;
}
