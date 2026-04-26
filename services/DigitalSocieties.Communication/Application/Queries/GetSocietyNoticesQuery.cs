using MediatR;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Communication.Domain.Entities;
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

        // Parse Type string to enum for type-safe EF Core filter
        if (!string.IsNullOrWhiteSpace(request.Type) &&
            Enum.TryParse<NoticeType>(request.Type, ignoreCase: true, out var typeEnum))
            query = query.Where(n => n.Type == typeEnum);

        var total = await query.CountAsync(ct);

        // Fetch then project client-side: enum.ToString() not reliably translated by Npgsql
        var raw = await query
            .OrderByDescending(n => n.IsPinned)
            .ThenByDescending(n => n.CreatedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(ct);

        var items = raw.Select(n => new NoticeSummaryDto(
            n.Id, n.Title, n.Body, n.Type.ToString(),
            n.IsPinned, n.CreatedAt, n.ExpiresAt)).ToList();

        return Result<NoticePagedResult>.Ok(
            new NoticePagedResult(items, total, request.Page, request.PageSize));
    }
}
