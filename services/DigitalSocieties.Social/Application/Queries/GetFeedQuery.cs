using MediatR;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Social.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DigitalSocieties.Social.Application.Queries;

public record GetFeedQuery(
    Guid SocietyId,
    Guid? GroupId,
    string? Category,
    int Page,
    int PageSize) : IRequest<Result<FeedPagedResult>>;

public record FeedPostDto(
    Guid Id,
    string Category,
    string Body,
    IReadOnlyList<string> ImageUrls,
    bool IsPinned,
    bool IsLocked,
    Guid AuthorUserId,
    string AuthorFlatDisplay,
    Guid? GroupId,
    int ReactionCount,
    int CommentCount,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ExpiresAt,
    // Marketplace
    long? PricePaise,
    string? Condition,
    bool? IsSold);

public record FeedPagedResult(
    IReadOnlyList<FeedPostDto> Items,
    int TotalCount,
    int Page,
    int PageSize);

internal sealed class GetFeedQueryHandler(SocialDbContext db)
    : IRequestHandler<GetFeedQuery, Result<FeedPagedResult>>
{
    public async Task<Result<FeedPagedResult>> Handle(GetFeedQuery request, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;

        var query = db.Posts
            .Where(p => p.SocietyId == request.SocietyId
                     && !p.IsDeleted
                     && (p.ExpiresAt == null || p.ExpiresAt > now));

        if (request.GroupId.HasValue)
            query = query.Where(p => p.GroupId == request.GroupId.Value);

        if (!string.IsNullOrWhiteSpace(request.Category))
            query = query.Where(p => p.Category == request.Category);

        var total = await query.CountAsync(ct);

        // Pinned first, then newest
        var items = await query
            .OrderByDescending(p => p.IsPinned)
            .ThenByDescending(p => p.CreatedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(p => new FeedPostDto(
                p.Id,
                p.Category,
                p.Body,
                p.ImageUrls,
                p.IsPinned,
                p.IsLocked,
                p.AuthorUserId,
                p.AuthorFlatId.ToString(), // resolved to flat display by client or separate query
                p.GroupId,
                p.Reactions.Count,
                p.Comments.Count(c => !c.IsDeleted),
                p.CreatedAt,
                p.ExpiresAt,
                // Marketplace join via left join pattern
                db.Listings
                    .Where(l => l.PostId == p.Id)
                    .Select(l => (long?)l.PricePaise)
                    .FirstOrDefault(),
                db.Listings
                    .Where(l => l.PostId == p.Id)
                    .Select(l => l.Condition)
                    .FirstOrDefault(),
                db.Listings
                    .Where(l => l.PostId == p.Id)
                    .Select(l => (bool?)l.IsSold)
                    .FirstOrDefault()))
            .ToListAsync(ct);

        return Result<FeedPagedResult>.Ok(
            new FeedPagedResult(items, total, request.Page, request.PageSize));
    }
}
