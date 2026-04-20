using MediatR;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Billing.Domain.Entities;
using DigitalSocieties.Billing.Infrastructure.Persistence;

namespace DigitalSocieties.Billing.Application.Queries;

/// <summary>Admin dashboard: collection stats for a society + period.</summary>
public sealed record GetSocietyBillSummaryQuery(Guid SocietyId, string Period)
    : IRequest<Result<SocietyBillSummaryDto>>;

public sealed record SocietyBillSummaryDto(
    string  Period,
    int     TotalBills,
    int     PaidCount,
    int     PendingCount,
    int     OverdueCount,
    decimal TotalAmountDue,
    decimal TotalCollected,
    decimal CollectionPercentage,
    IReadOnlyList<DefaulterDto> Defaulters);

public sealed record DefaulterDto(Guid FlatId, string FlatNumber, string Period, decimal AmountDue, int DaysOverdue);

public sealed class GetSocietyBillSummaryQueryHandler
    : IRequestHandler<GetSocietyBillSummaryQuery, Result<SocietyBillSummaryDto>>
{
    private readonly BillingDbContext _db;

    public GetSocietyBillSummaryQueryHandler(BillingDbContext db) => _db = db;

    public async Task<Result<SocietyBillSummaryDto>> Handle(
        GetSocietyBillSummaryQuery query, CancellationToken ct)
    {
        var bills = await _db.Bills
            .AsNoTracking()
            .Where(b => b.SocietyId == query.SocietyId && b.Period == query.Period)
            .ToListAsync(ct);

        if (bills.Count == 0)
            return Result<SocietyBillSummaryDto>.Fail("BILLING.NO_BILLS",
                $"No bills found for period {query.Period}.");

        var paid    = bills.Where(b => b.Status == BillStatus.Paid).ToList();
        var pending = bills.Where(b => b.Status == BillStatus.Pending).ToList();
        var overdue = bills.Where(b => b.Status == BillStatus.Overdue).ToList();

        decimal totalDue     = bills.Sum(b => b.TotalDue.Amount);
        decimal totalCollect = paid.Sum(b => b.TotalDue.Amount);
        decimal pct          = totalDue > 0 ? Math.Round(totalCollect / totalDue * 100, 1) : 0;

        // Defaulters = overdue + pending past due date
        var today       = DateOnly.FromDateTime(DateTime.Today);
        var defaulters  = bills
            .Where(b => b.Status != BillStatus.Paid && b.Status != BillStatus.Waived && b.DueDate < today)
            .Select(b => new DefaulterDto(
                b.FlatId,
                "",            // flat number resolved by API layer joining identity schema
                b.Period,
                b.TotalDue.Amount,
                today.DayNumber - b.DueDate.DayNumber))
            .OrderByDescending(d => d.DaysOverdue)
            .ToList();

        return Result<SocietyBillSummaryDto>.Ok(new SocietyBillSummaryDto(
            query.Period, bills.Count,
            paid.Count, pending.Count, overdue.Count,
            totalDue, totalCollect, pct, defaulters));
    }
}
