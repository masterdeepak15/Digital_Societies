using System.Globalization;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Domain.ValueObjects;
using DigitalSocieties.Billing.Application.Commands;
using DigitalSocieties.Billing.Domain.Entities;
using DigitalSocieties.Billing.Infrastructure.Persistence;

namespace DigitalSocieties.Billing.Application;

public sealed record BillingAutomationResult(int BillsCreated, int LateFeesCharged, decimal LateFeeRupees, int RemindersSent);

/// <summary>
/// What a society's billing rules do by themselves each day: send bills on the billing day, add late fees past the grace
/// period, and remind flats three days before a bill falls due. Each part is switched on or off in Settings, and each
/// is safe to run twice on the same day (bills already issued are skipped, a bill is charged once, a reminder is only
/// sent for bills falling due in exactly three days).
/// </summary>
public sealed class BillingAutomation
{
    public const int ReminderDaysBefore = 3;

    private readonly BillingDbContext        _db;
    private readonly IMediator               _mediator;
    private readonly ISocietySettingsReader  _settings;
    private readonly INotificationDispatcher _dispatcher;

    public BillingAutomation(BillingDbContext db, IMediator mediator, ISocietySettingsReader settings, INotificationDispatcher dispatcher)
        => (_db, _mediator, _settings, _dispatcher) = (db, mediator, settings, dispatcher);

    public async Task<BillingAutomationResult> RunAsync(Guid societyId, DateOnly today, CancellationToken ct)
    {
        var rules = await _settings.GetAsync(societyId, ct);
        int created = 0, charged = 0, reminders = 0; decimal fees = 0;

        if (rules.AutoGenerateBills && rules.MaintenanceAmount > 0 && today.Day == rules.BillingCycleDay)
        {
            var (amount, note) = BillAmounts.For(rules.MaintenanceAmount, rules);
            var month = new DateTime(today.Year, today.Month, 1).ToString("MMMM yyyy", CultureInfo.InvariantCulture);
            var result = await _mediator.Send(new GenerateMonthlyBillsCommand(
                societyId, $"{today.Year}-{today.Month:D2}", amount, $"Maintenance for {month}{note}", today.AddDays(rules.DueDays)), ct);
            if (result.IsSuccess) created = result.Value!.BillsCreated;
        }

        if (rules.AutoLateFees && rules.LatePenaltyPercent > 0)
        {
            var late = await LateFees.ApplyAsync(_db, societyId, rules, today, ct);
            (charged, fees) = (late.BillsCharged, late.TotalRupees);
        }

        if (rules.PaymentReminders && rules.PushEnabled)
            reminders = await RemindAsync(societyId, today, ct);

        return new BillingAutomationResult(created, charged, fees, reminders);
    }

    private async Task<int> RemindAsync(Guid societyId, DateOnly today, CancellationToken ct)
    {
        var due = today.AddDays(ReminderDaysBefore);
        var bills = await _db.Bills.AsNoTracking()
            .Where(b => b.SocietyId == societyId && b.Status == BillStatus.Pending && b.DueDate == due)
            .ToListAsync(ct);

        var sent = 0;
        foreach (var bill in bills)
        {
            try
            {
                await _dispatcher.DispatchAsync(new NotificationMessage(
                    Recipient: bill.FlatId.ToString(),
                    Subject:   $"Maintenance due on {due.ToString("d MMM", CultureInfo.InvariantCulture)}",
                    Body:      $"{bill.Description}: ₹{bill.TotalDue.Amount.ToString("#,##0.##", CultureInfo.InvariantCulture)} is due in {ReminderDaysBefore} days. Pay in the app to avoid a late fee.",
                    TemplateId: null,
                    Data: new Dictionary<string, string> { ["type"] = "bill", ["channelId"] = "general", ["recipientKind"] = "flat", ["billId"] = bill.Id.ToString() },
                    SocietyId: societyId), null, ct);
                sent++;
            }
            catch (Exception) { /* one flat's push failing must not stop the others */ }
        }
        return sent;
    }
}

/// <summary>Adds the late fee to unpaid bills past their grace period. Shared by the admin's button and the daily job.</summary>
public static class LateFees
{
    public sealed record Outcome(int BillsCharged, decimal TotalRupees);

    public static async Task<Outcome> ApplyAsync(BillingDbContext db, Guid societyId, SocietySettings rules, DateOnly today, CancellationToken ct)
    {
        var lastDueDateStillInGrace = today.AddDays(-rules.GracePeriodDays);
        var late = await db.Bills
            .Where(b => b.SocietyId == societyId
                     && (b.Status == BillStatus.Pending || b.Status == BillStatus.Overdue)
                     && b.DueDate < lastDueDateStillInGrace
                     && b.LateFee.Paise == 0)
            .ToListAsync(ct);

        decimal total = 0; var charged = 0;
        foreach (var bill in late)
        {
            var fee = Money.CreateInr(bill.Amount.Amount * rules.LatePenaltyPercent / 100m);
            if (fee.IsFailure || fee.Value!.Paise == 0) continue;
            bill.ApplyLateFee(fee.Value);
            total += fee.Value.Amount;
            charged++;
        }
        if (charged > 0) await db.SaveChangesAsync(ct);
        return new Outcome(charged, total);
    }
}
