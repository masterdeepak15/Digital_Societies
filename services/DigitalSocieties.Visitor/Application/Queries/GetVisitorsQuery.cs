using MediatR;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Visitor.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DigitalSocieties.Visitor.Application.Queries;

public record GetVisitorsQuery(
    Guid SocietyId,
    Guid? FlatId,
    string? Status,
    int Page,
    int PageSize) : IRequest<Result<PagedResult<VisitorDto>>>;

public record VisitorDto(
    Guid Id,
    string VisitorName,
    string VisitorPhone,
    string Purpose,
    string Status,
    Guid FlatId,
    string? VehicleNumber,
    string? QrToken,
    DateTimeOffset CreatedAt,
    DateTimeOffset? EntryTime,
    DateTimeOffset? ExitTime);

public record PagedResult<T>(IReadOnlyList<T> Items, int TotalCount, int Page, int PageSize);

internal sealed class GetVisitorsQueryHandler(VisitorDbContext db)
    : IRequestHandler<GetVisitorsQuery, Result<PagedResult<VisitorDto>>>
{
    public async Task<Result<PagedResult<VisitorDto>>> Handle(
        GetVisitorsQuery request, CancellationToken ct)
    {
        var query = db.Visitors
            .Where(v => v.SocietyId == request.SocietyId);

        if (request.FlatId.HasValue)
            query = query.Where(v => v.FlatId == request.FlatId.Value);

        if (!string.IsNullOrWhiteSpace(request.Status))
            query = query.Where(v => v.Status == request.Status);

        var total = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(v => v.CreatedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(v => new VisitorDto(
                v.Id,
                v.VisitorName,
                v.VisitorPhone,
                v.Purpose,
                v.Status,
                v.FlatId,
                v.VehicleNumber,
                v.QrToken,
                v.CreatedAt,
                v.EntryTime,
                v.ExitTime))
            .ToListAsync(ct);

        return Result<PagedResult<VisitorDto>>.Ok(
            new PagedResult<VisitorDto>(items, total, request.Page, request.PageSize));
    }
}
