using MediatR;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Accounting.Domain.Entities;
using DigitalSocieties.Accounting.Infrastructure.Persistence;

namespace DigitalSocieties.Accounting.Application.Queries;

// ── DTOs ───────────────────────────────────────────────────────────────────
public sealed record LedgerEntryDto(
    Guid     Id,
    string   Type,
    string   Category,
    string   Description,
    long     AmountPaise,
    DateOnly EntryDate,
    string   Status,
    string?  ReceiptUrl,
    DateTimeOffset CreatedAt);

// ── Query: paginated ledger list ───────────────────────────────────────────
public sealed record GetLedgerEntriesQuery(
    string?  Type      = null,   // "Income" | "Expense" | null = all
    string?  Category  = null,
    int      Month     = 0,      // 0 = current month
    int      Year      = 0,
    int      Page      = 1,
    int      PageSize  = 50,
    bool     PendingOnly = false
) : IRequest<Result<PagedResult<LedgerEntryDto>>>;

public sealed class GetLedgerEntriesHandler
    : IRequestHandler<GetLedgerEntriesQuery, Result<PagedResult<LedgerEntryDto>>>
{
    private readonly AccountingDbContext _db;
    private readonly ICurrentUser        _currentUser;

    public GetLedgerEntriesHandler(AccountingDbContext db, ICurrentUser currentUser)
        => (_db, _currentUser) = (db, currentUser);

    public async Task<Result<PagedResult<LedgerEntryDto>>> Handle(
        GetLedgerEntriesQuery q, CancellationToken ct)
    {
        var month = q.Month > 0 ? q.Month : DateTimeOffset.UtcNow.Month;
        var year  = q.Year  > 0 ? q.Year  : DateTimeOffset.UtcNow.Year;

        var query = _db.LedgerEntries
            .Where(e => e.SocietyId == _currentUser.SocietyId
                     && e.EntryDate.Month == month
                     && e.EntryDate.Year  == year
                     && !e.IsDeleted);

        if (q.Type is not null && Enum.TryParse<EntryType>(q.Type, out var t))
            query = query.Where(e => e.Type == t);

        if (q.Category is not null)
            query = query.Where(e => e.Category == q.Category);

        if (q.PendingOnly)
            query = query.Where(e => e.Status == ApprovalStatus.PendingApproval);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(e => e.EntryDate)
            .Skip((q.Page - 1) * q.PageSize)
            .Take(q.PageSize)
            .Select(e => new LedgerEntryDto(e.Id, e.Type.ToString(), e.Category,
                e.Description, e.Amount.Paise, e.EntryDate,
                e.Status.ToString(), e.ReceiptUrl, e.CreatedAt))
            .ToListAsync(ct);

        return Result<PagedResult<LedgerEntryDto>>.Ok(
            new PagedResult<LedgerEntryDto>(items, total, q.Page, q.PageSize));
    }
}

// ── Query: monthly P&L summary ─────────────────────────────────────────────
public sealed record GetMonthlyReportQuery(int Month = 0, int Year = 0)
    : IRequest<Result<MonthlyReportDto>>;

public sealed record MonthlyReportDto(
    int    Month,
    int    Year,
    long   TotalIncomePaise,
    long   TotalExpensePaise,
    long   NetPaise,
    List<CategorySummary> IncomeByCategory,
    List<CategorySummary> ExpenseByCategory,
    int    PendingApprovals);

public sealed record CategorySummary(string Category, long AmountPaise, int Count);

public sealed class GetMonthlyReportHandler
    : IRequestHandler<GetMonthlyReportQuery, Result<MonthlyReportDto>>
{
    private readonly AccountingDbContext _db;
    private readonly ICurrentUser        _currentUser;

    public GetMonthlyReportHandler(AccountingDbContext db, ICurrentUser currentUser)
        => (_db, _currentUser) = (db, currentUser);

    public async Task<Result<MonthlyReportDto>> Handle(
        GetMonthlyReportQuery q, CancellationToken ct)
    {
        var month = q.Month > 0 ? q.Month : DateTimeOffset.UtcNow.Month;
        var year  = q.Year  > 0 ? q.Year  : DateTimeOffset.UtcNow.Year;

        var entries = await _db.LedgerEntries
            .Where(e => e.SocietyId == _currentUser.SocietyId
                     && e.EntryDate.Month == month
                     && e.EntryDate.Year  == year
                     && e.Status == ApprovalStatus.Approved
                     && !e.IsDeleted)
            .ToListAsync(ct);

        var income   = entries.Where(e => e.Type == EntryType.Income).ToList();
        var expenses = entries.Where(e => e.Type == EntryType.Expense).ToList();

        var pending = await _db.LedgerEntries
            .CountAsync(e => e.SocietyId == _currentUser.SocietyId
                          && e.Status == ApprovalStatus.PendingApproval
                          && !e.IsDeleted, ct);

        return Result<MonthlyReportDto>.Ok(new MonthlyReportDto(
            month, year,
            income.Sum(e => e.Amount.Paise),
            expenses.Sum(e => e.Amount.Paise),
            income.Sum(e => e.Amount.Paise) - expenses.Sum(e => e.Amount.Paise),
            income.GroupBy(e => e.Category)
                  .Select(g => new CategorySummary(g.Key, g.Sum(e => e.Amount.Paise), g.Count()))
                  .OrderByDescending(c => c.AmountPaise).ToList(),
            expenses.GroupBy(e => e.Category)
                    .Select(g => new CategorySummary(g.Key, g.Sum(e => e.Amount.Paise), g.Count()))
                    .OrderByDescending(c => c.AmountPaise).ToList(),
            pending));
    }
}

public sealed record PagedResult<T>(List<T> Items, int TotalCount, int Page, int PageSize);
