using MediatR;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Complaint.Domain.Entities;
using DigitalSocieties.Complaint.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DigitalSocieties.Complaint.Application.Queries;

public record GetSocietyComplaintsQuery(
    Guid SocietyId,
    string? Status,
    string? Category,
    int Page,
    int PageSize) : IRequest<Result<ComplaintPagedResult>>;

internal sealed class GetSocietyComplaintsQueryHandler(ComplaintDbContext db)
    : IRequestHandler<GetSocietyComplaintsQuery, Result<ComplaintPagedResult>>
{
    public async Task<Result<ComplaintPagedResult>> Handle(
        GetSocietyComplaintsQuery request, CancellationToken ct)
    {
        var query = db.Complaints
            .Where(c => c.SocietyId == request.SocietyId && !c.IsDeleted);

        if (!string.IsNullOrWhiteSpace(request.Status) &&
            Enum.TryParse<ComplaintStatus>(request.Status, ignoreCase: true, out var statusEnum))
            query = query.Where(c => c.Status == statusEnum);

        if (!string.IsNullOrWhiteSpace(request.Category))
            query = query.Where(c => c.Category == request.Category);

        var total = await query.CountAsync(ct);

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
