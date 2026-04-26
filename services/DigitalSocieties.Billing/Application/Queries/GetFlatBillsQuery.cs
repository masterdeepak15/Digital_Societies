using MediatR;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Billing.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DigitalSocieties.Billing.Application.Queries;

// ── Query ────────────────────────────────────────────────────────────────────
public sealed record GetFlatBillsQuery(Guid FlatId, int PageSize = 12, int Page = 1)
    : IRequest<Result<PagedResult<BillDto>>>;

public sealed record BillDto(
    Guid     Id,
    string   Period,
    decimal  Amount,
    decimal  LateFee,
    decimal  TotalDue,
    string   Status,
    DateOnly DueDate,
    DateTimeOffset? PaidAt,
    string?  PaymentId,
    string   Description);

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);

// ── Handler ──────────────────────────────────────────────────────────────────
public sealed class GetFlatBillsQueryHandler
    : IRequestHandler<GetFlatBillsQuery, Result<PagedResult<BillDto>>>
{
    private readonly BillingDbContext _db;

    public GetFlatBillsQueryHandler(BillingDbContext db) => _db = db;

    public async Task<Result<PagedResult<BillDto>>> Handle(
        GetFlatBillsQuery query, CancellationToken ct)
    {
        var q = _db.Bills
            .AsNoTracking()
            .Where(b => b.FlatId == query.FlatId)
            .OrderByDescending(b => b.Period);

        var total = await q.CountAsync(ct);

        var bills = await q
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(b => new BillDto(
                b.Id,
                b.Period,
                b.Amount.Amount,
                b.LateFee.Amount,
                b.TotalDue.Amount,
                b.Status.ToString().ToLower(),
                b.DueDate,
                b.PaidAt,
                b.PaymentId,
                b.Description))
            .ToListAsync(ct);

        return Result<PagedResult<BillDto>>.Ok(
            new PagedResult<BillDto>(bills, total, query.Page, query.PageSize));
    }
}
