using MediatR;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Social.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DigitalSocieties.Social.Application.Queries;

public record GetPostDetailQuery(Guid PostId, Guid RequestingUserId)
    : IRequest<Result<PostDetailDto>>;

public record CommentDto(
    Guid Id,
    Guid? ParentId,
    Guid AuthorUserId,
    string AuthorFlatDisplay,
    string Body,
    bool IsDeleted,
    DateTimeOffset CreatedAt);

public record ReactionSummaryDto(string Type, int Count, bool CurrentUserReacted);

public record PostDetailDto(
    Guid Id,
    string Category,
    string Body,
    IReadOnlyList<string> ImageUrls,
    bool IsPinned,
    bool IsLocked,
    Guid AuthorUserId,
    string AuthorFlatDisplay,
    Guid? GroupId,
    IReadOnlyList<ReactionSummaryDto> Reactions,
    IReadOnlyList<CommentDto> Comments,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ExpiresAt,
    // Embedded poll results (if category == poll)
    PollResultDto? Poll,
    // Embedded marketplace (if category == for_sale)
    MarketplaceDto? Marketplace);

public record PollResultDto(
    Guid PollId,
    string Question,
    IReadOnlyList<PollOptionResultDto> Options,
    DateTimeOffset? EndsAt,
    bool HasEnded,
    bool CurrentUserVoted,
    List<Guid>? CurrentUserVoteOptionIds);

public record PollOptionResultDto(Guid OptionId, string Text, int Votes, double Percentage);

public record MarketplaceDto(
    Guid ListingId,
    long? PricePaise,
    string Condition,
    bool IsSold);

internal sealed class GetPostDetailQueryHandler(SocialDbContext db)
    : IRequestHandler<GetPostDetailQuery, Result<PostDetailDto>>
{
    public async Task<Result<PostDetailDto>> Handle(
        GetPostDetailQuery request, CancellationToken ct)
    {
        var post = await db.Posts
            .Include(p => p.Reactions)
            .Include(p => p.Comments)
            .FirstOrDefaultAsync(p => p.Id == request.PostId && !p.IsDeleted, ct);

        if (post is null)
            return Result<PostDetailDto>.Fail(
                new Error("Post.NotFound", "Post not found."));

        // Reaction summary grouped by type
        var reactionSummary = post.Reactions
            .GroupBy(r => r.Type)
            .Select(g => new ReactionSummaryDto(
                g.Key,
                g.Count(),
                g.Any(r => r.UserId == request.RequestingUserId)))
            .ToList();

        var comments = post.Comments
            .OrderBy(c => c.CreatedAt)
            .Select(c => new CommentDto(
                c.Id, c.ParentId, c.AuthorUserId,
                c.AuthorFlatId.ToString(),
                c.IsDeleted ? "[deleted]" : c.Body,
                c.IsDeleted, c.CreatedAt))
            .ToList();

        // Poll (optional)
        PollResultDto? pollDto = null;
        if (post.Category == "poll")
        {
            var poll = await db.Polls
                .Include(p => p.Votes)
                .FirstOrDefaultAsync(p => p.PostId == post.Id, ct);

            if (poll is not null)
            {
                var totalVotes = poll.Votes.Count;
                var userVote = poll.Votes
                    .FirstOrDefault(v => v.UserId == request.RequestingUserId);

                var optionResults = poll.Options.Select(opt =>
                {
                    var count = poll.Votes.Count(v => v.OptionIds.Contains(opt.Id));
                    return new PollOptionResultDto(
                        opt.Id, opt.Text, count,
                        totalVotes > 0 ? Math.Round((double)count / totalVotes * 100, 1) : 0);
                }).ToList();

                pollDto = new PollResultDto(
                    poll.Id, poll.Question, optionResults,
                    poll.EndsAt, poll.HasEnded(),
                    userVote is not null, userVote?.OptionIds);
            }
        }

        // Marketplace (optional)
        MarketplaceDto? marketplaceDto = null;
        if (post.Category == "for_sale")
        {
            var listing = await db.Listings
                .FirstOrDefaultAsync(l => l.PostId == post.Id, ct);

            if (listing is not null)
                marketplaceDto = new MarketplaceDto(
                    listing.Id, listing.PricePaise, listing.Condition, listing.IsSold);
        }

        return Result<PostDetailDto>.Ok(new PostDetailDto(
            post.Id, post.Category, post.Body, post.ImageUrls,
            post.IsPinned, post.IsLocked, post.AuthorUserId,
            post.AuthorFlatId.ToString(), post.GroupId,
            reactionSummary, comments,
            post.CreatedAt, post.ExpiresAt,
            pollDto, marketplaceDto));
    }
}
