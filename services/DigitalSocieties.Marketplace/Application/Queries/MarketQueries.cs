using MediatR;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Marketplace.Domain.Entities;
using DigitalSocieties.Marketplace.Infrastructure.Persistence;

namespace DigitalSocieties.Marketplace.Application.Queries;

/// <summary>AuthorFlatDisplay carries the flat id; the endpoint swaps it for the label ("A-101"), as the feed does.</summary>
public sealed record MarketPostDto(
    Guid Id, string Kind, string Title, string Description, decimal? PriceRupees, string? Condition,
    List<string> ImageIds, string Status, Guid AuthorUserId, string AuthorFlatDisplay, bool IsMine,
    int ReplyCount, DateTimeOffset CreatedAt, Guid? ClosedWithUserId);

public sealed record MarketReplyDto(Guid Id, Guid AuthorUserId, string AuthorFlatDisplay, string Body, bool IsMine, DateTimeOffset CreatedAt);

public sealed record MarketPostDetailDto(MarketPostDto Post, IReadOnlyList<MarketReplyDto> Replies);

// ── The list ────────────────────────────────────────────────────────────────
public sealed record GetMarketPostsQuery(string? Kind, string? Status, bool Mine, int Page, int PageSize)
    : IRequest<Result<List<MarketPostDto>>>;

public sealed class GetMarketPostsHandler : IRequestHandler<GetMarketPostsQuery, Result<List<MarketPostDto>>>
{
    private readonly MarketplaceDbContext _db;
    private readonly ICurrentUser         _cu;
    public GetMarketPostsHandler(MarketplaceDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result<List<MarketPostDto>>> Handle(GetMarketPostsQuery q, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId) return Result<List<MarketPostDto>>.Fail("AUTH.REQUIRED", "Authentication context required.");
        var me = _cu.UserId;

        var query = _db.MarketPosts.AsNoTracking().Where(p => p.SocietyId == societyId && !p.IsDeleted);
        if (Enum.TryParse<MarketKind>(q.Kind, true, out var kind)) query = query.Where(p => p.Kind == kind);
        if (Enum.TryParse<MarketStatus>(q.Status, true, out var status)) query = query.Where(p => p.Status == status);
        if (q.Mine) query = query.Where(p => p.AuthorUserId == me);

        var page     = Math.Max(1, q.Page);
        var pageSize = Math.Clamp(q.PageSize, 1, 50);

        // Open deals first, then newest
        var rows = await query
            .OrderBy(p => p.Status == MarketStatus.Closed ? 1 : 0)
            .ThenByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(p => new
            {
                p.Id, p.Kind, p.Title, p.Description, p.PricePaise, p.Condition, p.ImageIds, p.Status,
                p.AuthorUserId, p.AuthorFlatId, p.CreatedAt, p.ClosedWithUserId,
                Replies = _db.MarketReplies.Count(r => r.PostId == p.Id && !r.IsDeleted),
            })
            .ToListAsync(ct);

        return Result<List<MarketPostDto>>.Ok(rows.Select(r => new MarketPostDto(
            r.Id, r.Kind.ToString(), r.Title, r.Description, r.PricePaise is null ? null : r.PricePaise / 100m, r.Condition,
            r.ImageIds, r.Status.ToString(), r.AuthorUserId, r.AuthorFlatId?.ToString() ?? string.Empty, r.AuthorUserId == me,
            r.Replies, r.CreatedAt, r.ClosedWithUserId)).ToList());
    }
}

// ── One post with its replies ───────────────────────────────────────────────
public sealed record GetMarketPostQuery(Guid PostId) : IRequest<Result<MarketPostDetailDto>>;

public sealed class GetMarketPostHandler : IRequestHandler<GetMarketPostQuery, Result<MarketPostDetailDto>>
{
    private readonly MarketplaceDbContext _db;
    private readonly ICurrentUser         _cu;
    public GetMarketPostHandler(MarketplaceDbContext db, ICurrentUser cu) => (_db, _cu) = (db, cu);

    public async Task<Result<MarketPostDetailDto>> Handle(GetMarketPostQuery q, CancellationToken ct)
    {
        if (_cu.SocietyId is not { } societyId) return Result<MarketPostDetailDto>.Fail("AUTH.REQUIRED", "Authentication context required.");
        var me = _cu.UserId;

        var p = await _db.MarketPosts.AsNoTracking().FirstOrDefaultAsync(x => x.Id == q.PostId && x.SocietyId == societyId && !x.IsDeleted, ct);
        if (p is null) return Result<MarketPostDetailDto>.Fail("MARKET.NOT_FOUND", "Post not found.");

        var replies = await _db.MarketReplies.AsNoTracking()
            .Where(r => r.PostId == p.Id && !r.IsDeleted)
            .OrderBy(r => r.CreatedAt)
            .ToListAsync(ct);

        var post = new MarketPostDto(p.Id, p.Kind.ToString(), p.Title, p.Description, p.PricePaise is null ? null : p.PricePaise / 100m, p.Condition,
            p.ImageIds, p.Status.ToString(), p.AuthorUserId, p.AuthorFlatId?.ToString() ?? string.Empty, p.AuthorUserId == me,
            replies.Count, p.CreatedAt, p.ClosedWithUserId);

        return Result<MarketPostDetailDto>.Ok(new MarketPostDetailDto(post, replies.Select(r =>
            new MarketReplyDto(r.Id, r.AuthorUserId, r.AuthorFlatId?.ToString() ?? string.Empty, r.Body, r.AuthorUserId == me, r.CreatedAt)).ToList()));
    }
}
