using MediatR;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Communication.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DigitalSocieties.Communication.Application.Queries;

public record GetSocietyNoticesQuery(
    Guid SocietyId,
    string? Type,
    int Page,
    int PageSize) : IRequest<Result<NoticePagedResult>>;

public record NoticeSummaryDto(
    Guid Id,
    string Title,
    string Body,
    string Type,
    bool IsPinned,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ExpiresAt);

public record NoticePagedResult(
    IReadOnlyList<NoticeSummaryDto> Items,
    int TotalCount,
    int Page,
    int PageSize);

internal sealed class GetSocietyNoticesQueryHandler(CommunicationDbContext db)
    : IRequestHandler<GetSocietyNoticesQuery, Result<NoticePagedResult>>
{
    public async Task<Result<NoticePagedResult>> Handle(
        GetSocietyNoticesQuery request, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;

        var query = db.Notices
            .Where(n => n.SocietyId == request.SocietyId
                     && !n.IsDeleted
                     && (n.ExpiresAt == null || n.ExpiresAt > now));

        if (!string.IsNullOrWhiteSpace(request.Type))
            query = query.Where(n => n.Type == request.Type);

        var total = await query.CountAsync(ct);

        // Pinned notices first, then newest
        var items = await query
            .OrderByDescending(n => n.IsPinned)
            .ThenByDescending(n => n.CreatedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(n => new NoticeSummaryDto(
                n.Id, n.Title, n.Body, n.Type,
                n.IsPinned, n.CreatedAt, n.ExpiresAt))
            .ToListAsync(ct);

        return Result<NoticePagedResult>.Ok(
            new NoticePagedResult(items, total, request.Page, request.PageSize));
    }
}
