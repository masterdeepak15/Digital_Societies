using System.ComponentModel;
using System.Text.Json;
using MediatR;
using ModelContextProtocol.Server;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Billing.Application.Queries;
using DigitalSocieties.Mcp.Settings;
using Microsoft.Extensions.Options;

namespace DigitalSocieties.Mcp.Tools;

/// <summary>
/// MCP billing tools — thin wrappers over existing MediatR queries.
/// SRP: billing concerns only.
/// </summary>
[McpServerToolType]
public sealed class BillingTools
{
    private readonly IMediator    _mediator;
    private readonly ICurrentUser _currentUser;
    private readonly McpSettings  _settings;

    public BillingTools(IMediator mediator, ICurrentUser currentUser, IOptions<McpSettings> opts)
        => (_mediator, _currentUser, _settings) = (mediator, currentUser, opts.Value);

    [McpServerTool(Name = "society.get_bills")]
    [Description(
        "Returns the authenticated resident's bills for the current society. " +
        "Shows amount due, due date, and payment status for each bill. " +
        "Use this when the resident asks about their maintenance dues, unpaid bills, or payment history.")]
    public async Task<string> GetBills(
        [Description("Optional month filter in YYYY-MM format (e.g. '2026-04'). Leave empty for all bills.")]
        string? month,
        CancellationToken ct)
    {
        if (!_settings.Enabled || !_settings.EnableGetBills)
            return "This tool is currently disabled by the society administrator.";

        if (_currentUser.FlatId is null)
            return "No flat context — please log in as a resident first.";

        var result = await _mediator.Send(new GetFlatBillsQuery(_currentUser.FlatId.Value), ct);

        if (result.IsFailure)
            return $"Error retrieving bills: {result.Error}";

        var bills = result.Value ?? [];

        if (!string.IsNullOrWhiteSpace(month) && DateTime.TryParse($"{month}-01", out var filterMonth))
            bills = bills.Where(b => b.BillingMonth.Year == filterMonth.Year
                                  && b.BillingMonth.Month == filterMonth.Month).ToList();

        if (bills.Count == 0)
            return month is null
                ? "No bills found for your flat."
                : $"No bills found for {month}.";

        var lines = bills.Select(b =>
            $"- {b.BillingMonth:MMM yyyy}: ₹{b.TotalAmount} | " +
            $"Status: {b.Status} | Due: {b.DueDate:dd MMM yyyy}" +
            (b.PaidAt.HasValue ? $" | Paid: {b.PaidAt:dd MMM yyyy}" : ""));

        var total   = bills.Where(b => b.Status != "Paid").Sum(b => b.TotalAmount);
        var summary = total > 0
            ? $"\nTotal outstanding: ₹{total}"
            : "\nAll bills are paid. ✓";

        return string.Join("\n", lines) + summary;
    }
}
