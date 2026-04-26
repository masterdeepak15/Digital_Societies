using DigitalSocieties.Shared.Domain.Entities;
using DigitalSocieties.Shared.Results;

namespace DigitalSocieties.Social.Domain.Entities;

/// <summary>
/// One-level-deep comment on a SocialPost.
/// parent_id == null → top-level comment.
/// parent_id != null → reply to a top-level comment (no deeper nesting).
/// </summary>
public sealed class PostComment : Entity
{
    public Guid PostId         { get; private set; }
    public Guid? ParentId      { get; private set; }   // null = top-level
    public Guid AuthorUserId   { get; private set; }
    public Guid AuthorFlatId   { get; private set; }
    public string Body         { get; private set; } = string.Empty;
    public bool IsDeleted      { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }

    private PostComment() { }

    public static Result<PostComment> Create(
        Guid postId,
        Guid authorUserId,
        Guid authorFlatId,
        string body,
        Guid? parentId = null)
    {
        if (string.IsNullOrWhiteSpace(body) || body.Length > 500)
            return Result<PostComment>.Fail(new Error("Comment.InvalidBody",
                "Comment must be between 1 and 500 characters."));

        return Result<PostComment>.Ok(new PostComment
        {
            Id           = Guid.NewGuid(),
            PostId       = postId,
            ParentId     = parentId,
            AuthorUserId = authorUserId,
            AuthorFlatId = authorFlatId,
            Body         = body.Trim(),
            CreatedAt    = DateTimeOffset.UtcNow,
        });
    }

    public Result<bool> SoftDelete()
    {
        IsDeleted = true;
        return Result<bool>.Ok(true);
    }
}
