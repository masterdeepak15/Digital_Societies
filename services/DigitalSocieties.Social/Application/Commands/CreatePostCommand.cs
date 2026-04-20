using MediatR;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Social.Domain.Entities;
using DigitalSocieties.Social.Domain.Enums;
using DigitalSocieties.Social.Domain.Events;
using DigitalSocieties.Social.Infrastructure.Persistence;
using DigitalSocieties.Social.Infrastructure.Hubs;

namespace DigitalSocieties.Social.Application.Commands;

public record CreatePostCommand(
    Guid SocietyId,
    Guid AuthorUserId,
    Guid AuthorFlatId,
    string Category,
    string Body,
    Guid? GroupId,
    List<string>? ImageUrls,
    // Polls
    string? PollQuestion,
    List<string>? PollOptions,
    DateTimeOffset? PollEndsAt,
    bool PollAllowMultiple,
    // Marketplace
    long? ListingPricePaise,
    string? ListingCondition) : IRequest<Result<CreatePostResult>>;

public record CreatePostResult(Guid PostId, string Category);

internal sealed class CreatePostCommandHandler(
    SocialDbContext db,
    ISocialHubNotifier hub,
    ICurrentUser currentUser) : IRequestHandler<CreatePostCommand, Result<CreatePostResult>>
{
    public async Task<Result<CreatePostResult>> Handle(
        CreatePostCommand request, CancellationToken ct)
    {
        // 1. Enforce admin-only categories
        if (PostCategory.AdminOnly.Contains(request.Category) &&
            !currentUser.IsInRole("admin"))
            return Result<CreatePostResult>.Fail(new Error("Post.Unauthorized",
                "Only admins can post to the Emergency Wall."));

        // 2. Create post aggregate
        var postResult = SocialPost.Create(
            request.SocietyId,
            request.AuthorUserId,
            request.AuthorFlatId,
            request.Category,
            request.Body,
            request.GroupId,
            request.ImageUrls);

        if (!postResult.IsSuccess) return Result<CreatePostResult>.Fail(postResult.Error!);
        var post = postResult.Value;

        db.Posts.Add(post);

        // 3. If poll — create SocialPoll child
        if (request.Category == PostCategory.Poll &&
            !string.IsNullOrWhiteSpace(request.PollQuestion) &&
            request.PollOptions?.Count >= 2)
        {
            var pollResult = SocialPoll.Create(
                post.Id,
                request.PollQuestion,
                request.PollOptions,
                request.PollEndsAt,
                request.PollAllowMultiple);

            if (!pollResult.IsSuccess) return Result<CreatePostResult>.Fail(pollResult.Error!);
            db.Polls.Add(pollResult.Value);
        }

        // 4. If for-sale — create MarketplaceListing child
        if (request.Category == PostCategory.ForSale &&
            !string.IsNullOrWhiteSpace(request.ListingCondition))
        {
            var listingResult = MarketplaceListing.Create(
                post.Id,
                request.ListingPricePaise,
                request.ListingCondition);

            if (!listingResult.IsSuccess) return Result<CreatePostResult>.Fail(listingResult.Error!);
            db.Listings.Add(listingResult.Value);
        }

        await db.SaveChangesAsync(ct);

        // 5. Real-time push
        if (request.Category == PostCategory.Emergency)
            await hub.NotifyEmergencyPostAsync(request.SocietyId, post.Id, request.Body, ct);
        else if (request.GroupId.HasValue)
            await hub.NotifyGroupPostAsync(request.GroupId.Value, post.Id, ct);
        else
            await hub.NotifyNewFeedPostAsync(request.SocietyId, post.Id, ct);

        return Result<CreatePostResult>.Ok(new CreatePostResult(post.Id, post.Category));
    }
}
