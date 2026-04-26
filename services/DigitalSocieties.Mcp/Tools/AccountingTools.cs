using System.ComponentModel;
using MediatR;
using ModelContextProtocol.Server;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Accounting.Application.Queries;
using DigitalSocieties.Mcp.Settings;
using Microsoft.Extensions.Options;

namespace DigitalSocieties.Mcp.Tools;

/// <summary>
/// MCP accounting tools — detect anomalous expenses for admin review.
/// </summary>
[McpServerToolType]
public sealed class AccountingTools
{
    private readonly IMediator    _mediator;
    private readonly ICurrentUser _currentUser;
    private readonly McpSettings  _settings;

    public AccountingTools(IMediator mediator, ICurrentUser currentUser, IOptions<McpSettings> opts)
        => (_mediator, _currentUser, _settings) = (mediator, currentUser, opts.Value);

    [McpServerTool(Name = "society.expense_anomaly")]
    [Description(
        "Analyses the society's recent ledger entries and flags statistically unusual expenses. " +
        "Use when an admin asks 'are there any suspicious expenses?', 'show me anomalies in the accounts', " +
        "or 'does anything look off in the budget?'. Only callable by admin role.")]
    public async Task<string> DetectExpenseAnomalies(
        [Description("Number of recent months to analyse (1–12). Default: 3.")]
        int months,
        [Description("Minimum expense amount in rupees to include (filters noise). Default: 1000.")]
        decimal minAmount,
        CancellationToken ct)
    {
        if (!_settings.Enabled || !_settings.EnableExpenseAnomaly)
            return "Expense anomaly detection is currently disabled.";

        if (!_currentUser.IsInRole("admin"))
            return "Only society admins can view expense analysis.";

        if (_currentUser.SocietyId is null)
            return "No society context — please log in first.";

        months    = Math.Clamp(months <= 0 ? 3 : months, 1, 12);
        minAmount = minAmount <= 0 ? 1000m : minAmount;

        // GetLedgerEntriesQuery has no "Status" parameter — use PendingOnly for pending filter
        var result = await _mediator.Send(
            new GetLedgerEntriesQuery(
                Type:     "Expense",
                Category: null,
                Month:    0,         // 0 = current month (handler default)
                Year:     0,
                Page:     1,
                PageSize: 200,
                PendingOnly: false),
            ct);

        if (result.IsFailure)
            return $"Could not retrieve ledger data: {result.Error}";

        // Result<PagedResult<LedgerEntryDto>> — extract items
        var allEntries = result.Value?.Items ?? [];

        // LedgerEntryDto.EntryDate is DateOnly; convert DateTimeOffset cutoff to DateOnly
        var sinceDate = DateOnly.FromDateTime(DateTimeOffset.UtcNow.AddMonths(-months).DateTime);

        // AmountPaise is stored in paise — convert to rupees for comparison
        var entries = allEntries
            .Where(e => e.EntryDate >= sinceDate && e.AmountPaise / 100m >= minAmount)
            .ToList();

        if (entries.Count == 0)
            return $"No expenses over ₹{minAmount} found in the last {months} month(s).";

        // ── Statistical anomaly detection (z-score per category) ───────────
        var byCategory = entries
            .GroupBy(e => e.Category)
            .ToDictionary(
                g => g.Key,
                g => g.Select(e => e.AmountPaise / 100m).ToList());  // amounts in rupees

        var anomalies = new List<string>();

        foreach (var pair in byCategory)
        {
            var category = pair.Key;
            var amounts  = pair.Value;

            if (amounts.Count < 2) continue; // need at least 2 data points

            var mean   = amounts.Average();
            var stdDev = Math.Sqrt(amounts.Average(a => Math.Pow((double)(a - mean), 2)));

            if (stdDev < 1) continue; // all identical — not anomalous

            foreach (var entry in entries.Where(e => e.Category == category))
            {
                var amountRupees = entry.AmountPaise / 100m;
                var z = Math.Abs((double)(amountRupees - mean) / stdDev);
                if (z > 2.0) // flag if > 2 standard deviations
                {
                    anomalies.Add(
                        $"  ⚠️  {entry.EntryDate:dd MMM yyyy}  [{category}]  " +
                        $"₹{amountRupees:N0}  (avg ₹{mean:N0}, z={z:F1})  — {entry.Description}");
                }
            }
        }

        // ── High-value pending approvals ────────────────────────────────────
        var pending = entries.Where(e => e.Status == "PendingApproval").ToList();

        var sb = new System.Text.StringBuilder();
        sb.AppendLine($"Expense analysis — last {months} month(s), min ₹{minAmount}\n");

        if (anomalies.Count == 0)
            sb.AppendLine("✅ No statistical anomalies detected.");
        else
        {
            sb.AppendLine($"🔍 {anomalies.Count} anomalous expense(s) flagged:");
            anomalies.ForEach(a => sb.AppendLine(a));
        }

        if (pending.Count > 0)
        {
            sb.AppendLine($"\n⏳ {pending.Count} expense(s) awaiting approval:");
            foreach (var p in pending.Take(5))
            {
                var amtRupees = p.AmountPaise / 100m;
                sb.AppendLine($"  • ₹{amtRupees:N0}  [{p.Category}]  {p.Description}");
            }
            if (pending.Count > 5)
                sb.AppendLine($"  … and {pending.Count - 5} more.");
        }

        var totalExpense = entries.Sum(e => e.AmountPaise / 100m);
        sb.AppendLine($"\nTotal expenses analysed: ₹{totalExpense:N0} across {entries.Count} entries.");

        return sb.ToString();
    }
}
