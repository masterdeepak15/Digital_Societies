using DigitalSocieties.Shared.Domain.Entities;
using DigitalSocieties.Shared.Results;

namespace DigitalSocieties.Social.Domain.Entities;

/// <summary>
/// A poll attached to a post (category = "poll").
/// Votes are one-per-user; can allow multiple option selection.
/// </summary>
public sealed class SocialPoll : Entity
{
    public Guid PostId           { get; private set; }
    public string Question       { get; private set; } = string.Empty;
    public List<PollOption> Options { get; private set; } = [];
    public DateTimeOffset? EndsAt { get; private set; }
    public bool AllowMultiple    { get; private set; }

    public ICollection<PollVote> Votes { get; private set; } = [];

    private SocialPoll() { }

    public static Result<SocialPoll> Create(
        Guid postId,
        string question,
        List<string> optionTexts,
        DateTimeOffset? endsAt,
        bool allowMultiple = false)
    {
        if (string.IsNullOrWhiteSpace(question))
            return Result<SocialPoll>.Fail(new Error("Poll.InvalidQuestion", "Poll question is required."));

        if (optionTexts.Count < 2 || optionTexts.Count > 8)
            return Result<SocialPoll>.Fail(new Error("Poll.InvalidOptions",
                "A poll must have between 2 and 8 options."));

        var options = optionTexts
            .Select((text, i) => new PollOption(Guid.NewGuid(), text.Trim()))
            .ToList();

        return Result<SocialPoll>.Ok(new SocialPoll
        {
            Id            = Guid.NewGuid(),
            PostId        = postId,
            Question      = question.Trim(),
            Options       = options,
            EndsAt        = endsAt,
            AllowMultiple = allowMultiple,
        });
    }

    public Result<bool> CastVote(Guid userId, List<Guid> optionIds)
    {
        if (EndsAt.HasValue && DateTimeOffset.UtcNow > EndsAt.Value)
            return Result<bool>.Fail(new Error("Poll.Closed", "This poll has ended."));

        var validOptionIds = Options.Select(o => o.Id).ToHashSet();
        if (!optionIds.All(id => validOptionIds.Contains(id)))
            return Result<bool>.Fail(new Error("Poll.InvalidOption", "One or more option IDs are invalid."));

        if (!AllowMultiple && optionIds.Count > 1)
            return Result<bool>.Fail(new Error("Poll.SingleChoiceOnly",
                "This poll only allows a single choice."));

        Votes.Add(new PollVote(Guid.NewGuid(), Id, userId, optionIds));
        return Result<bool>.Ok(true);
    }

    public bool HasEnded() => EndsAt.HasValue && DateTimeOffset.UtcNow >= EndsAt.Value;
}

public sealed record PollOption(Guid Id, string Text);

public sealed class PollVote : Entity
{
    public Guid PollId           { get; private set; }
    public Guid UserId           { get; private set; }
    public List<Guid> OptionIds  { get; private set; } = [];
    public DateTimeOffset VotedAt { get; private set; }

    private PollVote() { }

    public PollVote(Guid id, Guid pollId, Guid userId, List<Guid> optionIds)
    {
        Id        = id;
        PollId    = pollId;
        UserId    = userId;
        OptionIds = optionIds;
        VotedAt   = DateTimeOffset.UtcNow;
    }
}
