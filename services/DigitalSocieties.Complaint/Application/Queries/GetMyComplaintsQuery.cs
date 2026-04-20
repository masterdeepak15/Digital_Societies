using MediatR;
using DigitalSocieties.Shared.Results;
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
            .Where(c => c.RaisedByUserId == request.UserId && !c.IsDeleted);

        if (!string.IsNullOrWhiteSpace(request.Status))
            query = query.Where(c => c.Status == request.Status);

        var total = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(c => c.CreatedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(c => new ComplaintSummaryDto(
                c.Id, c.TicketNumber, c.Title, c.Category,
                c.Priority, c.Status, c.CreatedAt, c.ResolvedAt))
            .ToListAsync(ct);

        return Result<ComplaintPagedResult>.Ok(
            new ComplaintPagedResult(items, total, request.Page, request.PageSize));
    }
}
