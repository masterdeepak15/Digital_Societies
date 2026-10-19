using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Billing.Application;

namespace DigitalSocieties.Billing.Infrastructure;

/// <summary>
/// Runs <see cref="BillingAutomation"/> once a day for every society, after 9 in the morning India time.
/// A society's rules decide what happens (nothing, unless they switch something on in Settings). A restart on the
/// same day does not repeat the day's work for a society that already ran.
/// </summary>
public sealed class BillingAutomationService : BackgroundService
{
    private static readonly TimeSpan CheckEvery = TimeSpan.FromMinutes(20);
    private const int FirstHour = 9;

    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<BillingAutomationService> _log;
    private readonly Dictionary<Guid, DateOnly> _ran = new();

    public BillingAutomationService(IServiceScopeFactory scopes, ILogger<BillingAutomationService> log) => (_scopes, _log) = (scopes, log);

    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        // Give the database migrations a moment at start-up.
        try { await Task.Delay(TimeSpan.FromMinutes(1), stop); } catch (OperationCanceledException) { return; }

        while (!stop.IsCancellationRequested)
        {
            try { await PassAsync(DateTimeOffset.UtcNow.AddHours(5.5), stop); }
            catch (Exception e) when (e is not OperationCanceledException) { _log.LogError(e, "[BillingAutomation] a pass failed"); }

            try { await Task.Delay(CheckEvery, stop); } catch (OperationCanceledException) { return; }
        }
    }

    /// <summary>One pass at the given India time. Public so it can be run directly.</summary>
    public async Task PassAsync(DateTimeOffset indiaNow, CancellationToken ct)
    {
        if (indiaNow.Hour < FirstHour) return;
        var today = DateOnly.FromDateTime(indiaNow.DateTime);

        List<Guid> societies;
        using (var scope = _scopes.CreateScope())
            societies = (await scope.ServiceProvider.GetRequiredService<ISocietyDirectory>().ActiveSocietyIdsAsync(ct)).ToList();

        foreach (var id in societies)
        {
            if (_ran.TryGetValue(id, out var done) && done == today) continue;
            try
            {
                using var scope = _scopes.CreateScope();
                var r = await scope.ServiceProvider.GetRequiredService<BillingAutomation>().RunAsync(id, today, ct);
                _ran[id] = today;
                if (r.BillsCreated + r.LateFeesCharged + r.RemindersSent > 0)
                    _log.LogInformation("[BillingAutomation] society {Society}: {Bills} bills, {Fees} late fees (₹{Total}), {Reminders} reminders",
                        id, r.BillsCreated, r.LateFeesCharged, r.LateFeeRupees, r.RemindersSent);
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                _log.LogError(e, "[BillingAutomation] society {Society} failed; it will be tried again", id);
            }
        }
    }
}
