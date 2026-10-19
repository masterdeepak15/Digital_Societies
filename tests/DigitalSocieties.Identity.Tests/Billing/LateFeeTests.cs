using Xunit;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Domain.ValueObjects;
using DigitalSocieties.Billing.Application.Commands;
using DigitalSocieties.Billing.Domain.Entities;
using DigitalSocieties.Billing.Infrastructure.Persistence;

namespace DigitalSocieties.Identity.Tests.Billing;

/// <summary>Late fees use the society's own grace period and penalty from Settings, and are added once, when the admin asks.</summary>
public class LateFeeTests
{
    private static readonly Guid Society = Guid.NewGuid();
    private static readonly DateOnly Today = new(2026, 10, 19);

    private static BillingDbContext NewDb()
    {
        var cu = Substitute.For<ICurrentUser>();
        return new BillingDbContext(new DbContextOptionsBuilder<BillingDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options, cu);
    }

    private static ISocietySettingsReader Rules(int grace = 7, decimal penalty = 2m)
    {
        var r = Substitute.For<ISocietySettingsReader>();
        r.GetAsync(Society, Arg.Any<CancellationToken>()).Returns(new SocietySettings { GracePeriodDays = grace, LatePenaltyPercent = penalty });
        return r;
    }

    private static ICurrentUser Admin(Guid? society = null)
    {
        var cu = Substitute.For<ICurrentUser>();
        cu.SocietyId.Returns(society ?? Society);
        cu.UserId.Returns(Guid.NewGuid());
        return cu;
    }

    private static Bill NewBill(decimal rupees, DateOnly due, Guid? society = null)
        => Bill.Create(society ?? Society, Guid.NewGuid(), "2026-09", Money.CreateInr(rupees).Value!, due, "Maintenance");

    private static async Task<ApplyLateFeesResponse> Run(BillingDbContext db, ISocietySettingsReader rules, ICurrentUser? cu = null)
        => (await new ApplyLateFeesHandler(db, cu ?? Admin(), rules).Handle(new ApplyLateFeesCommand(Today), default)).Value!;

    [Fact] public async Task ABillPastItsGracePeriod_GetsThePenaltyPercentOfItsAmount()
    {
        var db = NewDb();
        db.Bills.Add(NewBill(3500m, Today.AddDays(-10)));                 // 10 days late, grace is 7
        await db.SaveChangesAsync();

        var r = await Run(db, Rules(grace: 7, penalty: 2m));

        r.BillsCharged.Should().Be(1);
        r.TotalLateFeeRupees.Should().Be(70m);                         // 2% of 3500
        var bill = await db.Bills.SingleAsync();
        (bill.LateFee.Amount, bill.Status).Should().Be((70m, BillStatus.Overdue));
        bill.TotalDue.Amount.Should().Be(3570m);
    }

    [Fact] public async Task ABillStillInsideTheGracePeriod_IsLeftAlone()
    {
        var db = NewDb();
        db.Bills.Add(NewBill(3500m, Today.AddDays(-7)));                  // exactly at the end of grace: not yet late
        db.Bills.Add(NewBill(3500m, Today.AddDays(3)));                   // not due yet
        await db.SaveChangesAsync();

        (await Run(db, Rules(7, 2m))).BillsCharged.Should().Be(0);
        (await db.Bills.CountAsync(b => b.LateFee.Paise > 0)).Should().Be(0);
    }

    [Fact] public async Task TheFeeIsAddedOnce_NoMatterHowOftenTheButtonIsPressed()
    {
        var db = NewDb();
        db.Bills.Add(NewBill(1000m, Today.AddDays(-30)));
        await db.SaveChangesAsync();

        await Run(db, Rules(7, 5m));
        var second = await Run(db, Rules(7, 5m));

        second.BillsCharged.Should().Be(0);
        (await db.Bills.SingleAsync()).LateFee.Amount.Should().Be(50m);
    }

    [Fact] public async Task PaidWaivedAndCancelledBills_NeverGetAFee()
    {
        var db = NewDb();
        var paid = NewBill(1000m, Today.AddDays(-30)); paid.MarkPaid("pay_1", DateTimeOffset.UtcNow);
        var waived = NewBill(1000m, Today.AddDays(-30)); waived.Waive("committee decision");
        db.Bills.AddRange(paid, waived);
        await db.SaveChangesAsync();

        (await Run(db, Rules(7, 10m))).BillsCharged.Should().Be(0);
    }

    [Fact] public async Task WithNoPenaltySet_NothingIsCharged()
    {
        var db = NewDb();
        db.Bills.Add(NewBill(1000m, Today.AddDays(-30)));
        await db.SaveChangesAsync();

        var r = await new ApplyLateFeesHandler(db, Admin(), Rules(7, 0m)).Handle(new ApplyLateFeesCommand(Today), default);

        r.Error!.Code.Should().Be("BILLING.NO_PENALTY");
        (await db.Bills.SingleAsync()).LateFee.Paise.Should().Be(0);
    }

    [Fact] public async Task OnlyTheCallersOwnSociety_IsCharged()
    {
        var db = NewDb();
        db.Bills.Add(NewBill(1000m, Today.AddDays(-30), society: Guid.NewGuid()));
        await db.SaveChangesAsync();

        (await Run(db, Rules(7, 5m))).BillsCharged.Should().Be(0);
    }

    [Fact] public async Task TheFee_IsRoundedToTheNearestPaisa()
    {
        var db = NewDb();
        db.Bills.Add(NewBill(3333m, Today.AddDays(-20)));
        await db.SaveChangesAsync();

        await Run(db, Rules(7, 2.5m));

        (await db.Bills.SingleAsync()).LateFee.Amount.Should().Be(83.33m);   // 2.5% of 3333 = 83.325
    }
}
