using DigitalSocieties.Shared.Domain.Entities;
using DigitalSocieties.Shared.Results;

namespace DigitalSocieties.Social.Domain.Entities;

/// <summary>
/// One reaction per user per post. Upsert semantics — changing reaction
/// replaces the previous one (no accumulation of different reaction types).
/// No "dislike" to prevent toxicity.
/// </summary>
public sealed class PostReaction : Entity
{
    public const string Helpful  = "helpful";
    public const string Thanks   = "thanks";
    public const string ThumbsUp = "thumbsup";

    public static readonly IReadOnlySet<string> Valid =
        new HashSet<string> { Helpful, Thanks, ThumbsUp };

    public Guid PostId   { get; private set; }
    public Guid UserId   { get; private set; }
    public string Type   { get; private set; } = ThumbsUp;
    public DateTimeOffset ReactedAt { get; private set; }

    private PostReaction() { }

    public static Result<PostReaction> Create(Guid postId, Guid userId, string type)
    {
        if (!Valid.Contains(type))
            return Result<PostReaction>.Fail(new Error("Reaction.Invalid",
                $"Reaction type '{type}' is not valid. Use: helpful, thanks, thumbsup."));

        return Result<PostReaction>.Ok(new PostReaction
        {
            Id        = Guid.NewGuid(),
            PostId    = postId,
            UserId    = userId,
            Type      = type,
            ReactedAt = DateTimeOffset.UtcNow,
        });
    }

    public void ChangeType(string newType) => Type = newType;
}
