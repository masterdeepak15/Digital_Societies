using MediatR;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Complaint.Domain.Entities;
using DigitalSocieties.Complaint.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DigitalSocieties.Complaint.Application.Queries;

public record GetMyComplaintsQuery(
    Guid UserId,
    string? Status,
    int Page,
    int PageSize) : IRequest<Result<ComplaintPagedResult>>;

public record ComplaintSummaryDto(
    Guid Id,
    string TicketNumber,
    string Title,
    string Category,
    string Priority,
    string Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ResolvedAt);

public record ComplaintPagedResult(
    IReadOnlyList<ComplaintSummaryDto> Items,
    int TotalCount,
    int Page,
    int PageSize);

internal sealed class GetMyComplaintsQueryHandler(ComplaintDbContext db)
    : IRequestHandler<GetMyComplaintsQuery, Result<ComplaintPagedResult>>
{
    public async Task<Result<ComplaintPagedResult>> Handle(
        GetMyComplaintsQuery request, CancellationToken ct)
    {
        var query = db.Complaints
            .Where(c => c.RaisedBy == request.UserId && !c.IsDeleted);

        // Filter by status enum when provided
        if (!string.IsNullOrWhiteSpace(request.Status) &&
            Enum.TryParse<ComplaintStatus>(request.Status, ignoreCase: true, out var statusEnum))
            query = query.Where(c => c.Status == statusEnum);

        var total = await query.CountAsync(ct);

        // Fetch entities, project ticket number client-side (EF can't translate Id.ToString("N"))
        var raw = await query
            .OrderByDescending(c => c.CreatedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(ct);

        var items = raw.Select(c => new ComplaintSummaryDto(
            c.Id,
            $"C-{c.CreatedAt.Year}-{c.Id.ToString("N")[..4].ToUpper()}",
            c.Title,
            c.Category,
            c.Priority.ToString(),
            c.Status.ToString(),
            c.CreatedAt,
            c.ResolvedAt
        )).ToList();

        return Result<ComplaintPagedResult>.Ok(
            new ComplaintPagedResult(items, total, request.Page, request.PageSize));
    }
}
