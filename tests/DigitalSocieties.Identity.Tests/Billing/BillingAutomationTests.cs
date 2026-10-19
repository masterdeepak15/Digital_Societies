using Xunit;
using FluentAssertions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Domain.ValueObjects;
using DigitalSocieties.Shared.Results;
using DigitalSocieties.Billing.Application;
using DigitalSocieties.Billing.Application.Commands;
using DigitalSocieties.Billing.Domain.Entities;
using DigitalSocieties.Billing.Infrastructure.Persistence;

namespace DigitalSocieties.Identity.Tests.Billing;

/// <summary>The society's billing rules, acted on without anyone pressing a button: bills on the billing day, late fees, reminders.</summary>
public class BillingAutomationTests
{
    private static readonly Guid Society = Guid.NewGuid();
    private static readonly DateOnly Day5 = new(2026, 10, 5);

    private sealed class Rig
    {
        public BillingDbContext Db = new(new DbContextOptionsBuilder<BillingDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options, Substitute.For<ICurrentUser>());
        public IMediator Mediator = Substitute.For<IMediator>();
        public INotificationDispatcher Dispatcher = Substitute.For<INotificationDispatcher>();
        public ISocietySettingsReader Settings = Substitute.For<ISocietySettingsReader>();

        public Rig(SocietySettings rules)
        {
            Settings.GetAsync(Society, Arg.Any<CancellationToken>()).Returns(rules);
            Mediator.Send(Arg.Any<GenerateMonthlyBillsCommand>(), Arg.Any<CancellationToken>())
                .Returns(Result<GenerateMonthlyBillsResponse>.Ok(new GenerateMonthlyBillsResponse(64, 0, "2026-10")));
        }

        public BillingAutomation Job => new(Db, Mediator, Settings, Dispatcher);
    }

    private static SocietySettings Auto(Action<SocietySettings>? _ = null) => new()
    {
        MaintenanceAmount = 3500, BillingCycleDay = 5, DueDays = 10, GracePeriodDays = 7, LatePenaltyPercent = 2m,
        AutoGenerateBills = true, AutoLateFees = true, PaymentReminders = true, PushEnabled = true,
    };

    // ── Bills on the billing day ──────────────────────────────────────────────

    [Fact] public async Task OnTheBillingDay_BillsGoOut_ForTheSavedAmount_DueAfterTheDueDays()
    {
        var rig = new Rig(Auto());

        var r = await rig.Job.RunAsync(Society, Day5, default);

        r.BillsCreated.Should().Be(64);
        await rig.Mediator.Received(1).Send(
            Arg.Is<GenerateMonthlyBillsCommand>(c => c.SocietyId == Society && c.Period == "2026-10" && c.AmountPerFlat == 3500m && c.DueDate == new DateOnly(2026, 10, 15)),
            Arg.Any<CancellationToken>());
    }

    [Fact] public async Task OnAnyOtherDay_NoBillsGoOut()
    {
        var rig = new Rig(Auto());
        (await rig.Job.RunAsync(Society, Day5.AddDays(1), default)).BillsCreated.Should().Be(0);
        await rig.Mediator.DidNotReceive().Send(Arg.Any<GenerateMonthlyBillsCommand>(), Arg.Any<CancellationToken>());
    }

    [Fact] public async Task WhenAutomaticBillsAreOff_OrNoAmountIsSet_NothingIsCreated()
    {
        var off = new Rig(Auto() with { AutoGenerateBills = false });
        await off.Job.RunAsync(Society, Day5, default);
        var none = new Rig(Auto() with { MaintenanceAmount = 0 });
        await none.Job.RunAsync(Society, Day5, default);

        await off.Mediator.DidNotReceive().Send(Arg.Any<GenerateMonthlyBillsCommand>(), Arg.Any<CancellationToken>());
        await none.Mediator.DidNotReceive().Send(Arg.Any<GenerateMonthlyBillsCommand>(), Arg.Any<CancellationToken>());
    }

    [Fact] public async Task WithGst_TheBillCarriesTheTaxAndSaysSo()
    {
        var rig = new Rig(Auto() with { GstEnabled = true, GstNumber = "27AAPFU0939F1ZV", GstPercent = 18m });

        await rig.Job.RunAsync(Society, Day5, default);

        await rig.Mediator.Received(1).Send(
            Arg.Is<GenerateMonthlyBillsCommand>(c => c.AmountPerFlat == 4130m && c.Description.Contains("GST 18%") && c.Description.Contains("27AAPFU0939F1ZV")),
            Arg.Any<CancellationToken>());
    }

    // ── Late fees ─────────────────────────────────────────────────────────────

    [Fact] public async Task WhenAutomaticLateFeesAreOn_ABillPastItsGracePeriodIsCharged_Once()
    {
        var rig = new Rig(Auto() with { AutoGenerateBills = false });
        rig.Db.Bills.Add(Bill.Create(Society, Guid.NewGuid(), "2026-09", Money.CreateInr(3500m).Value!, Day5.AddDays(-12), "Maintenance"));
        await rig.Db.SaveChangesAsync();

        var first = await rig.Job.RunAsync(Society, Day5, default);
        var second = await rig.Job.RunAsync(Society, Day5, default);

        (first.LateFeesCharged, first.LateFeeRupees).Should().Be((1, 70m));
        second.LateFeesCharged.Should().Be(0);
    }

    [Fact] public async Task WhenAutomaticLateFeesAreOff_NobodyIsCharged()
    {
        var rig = new Rig(Auto() with { AutoGenerateBills = false, AutoLateFees = false });
        rig.Db.Bills.Add(Bill.Create(Society, Guid.NewGuid(), "2026-09", Money.CreateInr(3500m).Value!, Day5.AddDays(-12), "Maintenance"));
        await rig.Db.SaveChangesAsync();

        (await rig.Job.RunAsync(Society, Day5, default)).LateFeesCharged.Should().Be(0);
    }

    // ── Reminders ─────────────────────────────────────────────────────────────

    [Fact] public async Task ARoundThreeDaysBeforeTheDueDate_TheFlatIsRemindedByPush()
    {
        var rig = new Rig(Auto() with { AutoGenerateBills = false, AutoLateFees = false });
        var flat = Guid.NewGuid();
        rig.Db.Bills.Add(Bill.Create(Society, flat, "2026-10", Money.CreateInr(3500m).Value!, Day5.AddDays(3), "Maintenance"));          // due in 3 days
        rig.Db.Bills.Add(Bill.Create(Society, Guid.NewGuid(), "2026-10", Money.CreateInr(3500m).Value!, Day5.AddDays(5), "Maintenance")); // due in 5
        var paid = Bill.Create(Society, Guid.NewGuid(), "2026-10", Money.CreateInr(3500m).Value!, Day5.AddDays(3), "Maintenance");
        paid.MarkPaid("pay_1", DateTimeOffset.UtcNow);
        rig.Db.Bills.Add(paid);                                                                                                           // already paid
        await rig.Db.SaveChangesAsync();

        var r = await rig.Job.RunAsync(Society, Day5, default);

        r.RemindersSent.Should().Be(1);
        await rig.Dispatcher.Received(1).DispatchAsync(
            Arg.Is<NotificationMessage>(m => m.Recipient == flat.ToString() && m.Subject.Contains("due") && m.Body.Contains("₹3,500") && m.Data!["recipientKind"] == "flat" && m.SocietyId == Society),
            Arg.Any<string?>(), Arg.Any<CancellationToken>());
    }

    [Fact] public async Task WhenRemindersOrPushAreOff_NoReminderIsSent()
    {
        foreach (var rules in new[] { Auto() with { PaymentReminders = false }, Auto() with { PushEnabled = false } })
        {
            var rig = new Rig(rules with { AutoGenerateBills = false, AutoLateFees = false });
            rig.Db.Bills.Add(Bill.Create(Society, Guid.NewGuid(), "2026-10", Money.CreateInr(3500m).Value!, Day5.AddDays(3), "Maintenance"));
            await rig.Db.SaveChangesAsync();

            (await rig.Job.RunAsync(Society, Day5, default)).RemindersSent.Should().Be(0);
        }
    }

    [Fact] public async Task AFailingPush_DoesNotStopTheRest()
    {
        var rig = new Rig(Auto() with { AutoGenerateBills = false, AutoLateFees = false });
        rig.Db.Bills.Add(Bill.Create(Society, Guid.NewGuid(), "2026-10", Money.CreateInr(3500m).Value!, Day5.AddDays(3), "Maintenance"));
        rig.Db.Bills.Add(Bill.Create(Society, Guid.NewGuid(), "2026-10", Money.CreateInr(3500m).Value!, Day5.AddDays(3), "Maintenance"));
        await rig.Db.SaveChangesAsync();
        rig.Dispatcher.DispatchAsync(Arg.Any<NotificationMessage>(), Arg.Any<string?>(), Arg.Any<CancellationToken>())
            .Returns<Task<string?>>(_ => throw new InvalidOperationException("push service down"), _ => Task.FromResult<string?>("push"));

        var r = await rig.Job.RunAsync(Society, Day5, default);

        r.RemindersSent.Should().Be(1);
    }
}

public class BillAmountTests
{
    [Fact] public void WithoutGst_TheAmountIsUnchanged()
        => BillAmounts.For(3500m, new SocietySettings()).Should().Be((3500m, string.Empty));

    [Fact] public void WithGst_TheTaxIsAdded_AndRoundedToThePaisa()
    {
        var (amount, note) = BillAmounts.For(3333m, new SocietySettings { GstEnabled = true, GstNumber = "27AAPFU0939F1ZV", GstPercent = 18m });
        amount.Should().Be(3932.94m);                                           // 3333 + 599.94
        note.Should().Be(" (incl. GST 18%, GSTIN 27AAPFU0939F1ZV)");
    }
}
