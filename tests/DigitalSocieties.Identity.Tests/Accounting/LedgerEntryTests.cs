using Xunit;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Domain.ValueObjects;
using DigitalSocieties.Accounting.Application.Commands;
using DigitalSocieties.Accounting.Application.Queries;
using DigitalSocieties.Accounting.Domain.Entities;
using DigitalSocieties.Accounting.Infrastructure.Persistence;

namespace DigitalSocieties.Identity.Tests.Accounting;

public class LedgerEntryTests
{
    private static readonly Guid Society = Guid.NewGuid();
    private static readonly Guid Admin = Guid.NewGuid();

    private static AccountingDbContext NewDb()
        => new(new DbContextOptionsBuilder<AccountingDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static ICurrentUser Me(bool admin = true, Guid? society = null)
    {
        var cu = Substitute.For<ICurrentUser>();
        cu.SocietyId.Returns(society ?? Society);
        cu.UserId.Returns(Admin);
        cu.IsInRole("admin").Returns(admin);
        return cu;
    }

    private static async Task<LedgerEntry> Add(AccountingDbContext db, EntryType type = EntryType.Expense, long paise = 5_000_000)
    {
        var e = LedgerEntry.Create(Society, type, "maintenance", "Lift AMC", Money.CreateInr(paise / 100m).Value!, new DateOnly(2026, 10, 18), Admin);
        db.LedgerEntries.Add(e);
        await db.SaveChangesAsync();
        return e;
    }

    // ── the approval rule ───────────────────────────────────────────────────────
    [Theory]
    [InlineData(EntryType.Expense, 1_000_000, false)]   // exactly 10,000: auto-approved
    [InlineData(EntryType.Expense, 1_000_100, true)]
    [InlineData(EntryType.Income, 9_000_000, false)]    // income never waits
    public void BigExpensesWaitForApproval(EntryType type, long paise, bool waits)
        => LedgerEntry.RequiresApproval(type, Money.CreateInr(paise / 100m).Value!).Should().Be(waits);

    // ── approve / reject say what is wrong ──────────────────────────────────────
    [Fact] public async Task Reject_ThenRejectOrApproveAgain_IsRefusedWithAClearMessage_NotAnException()
    {
        var db = NewDb();
        var e = await Add(db);
        var reject = new RejectLedgerEntryHandler(db, Me());
        (await reject.Handle(new RejectLedgerEntryCommand(e.Id, "Not budgeted"), default)).IsSuccess.Should().BeTrue();

        var again = await reject.Handle(new RejectLedgerEntryCommand(e.Id, "Again"), default);
        again.Error!.Code.Should().Be("ENTRY.NOT_PENDING");
        again.Error.Message.Should().Contain("rejected").And.Contain("Reopen");

        var approve = await new ApproveLedgerEntryHandler(db, Me()).Handle(new ApproveLedgerEntryCommand(e.Id), default);
        approve.Error!.Code.Should().Be("ENTRY.NOT_PENDING");
        (await db.LedgerEntries.SingleAsync()).RejectionReason.Should().Be("Not budgeted");
    }

    [Fact] public void Reject_NeedsAReason()
    {
        new RejectLedgerEntryValidator().Validate(new RejectLedgerEntryCommand(Guid.NewGuid(), " ")).IsValid.Should().BeFalse();
        new RejectLedgerEntryValidator().Validate(new RejectLedgerEntryCommand(Guid.NewGuid(), "Over budget")).IsValid.Should().BeTrue();
    }

    // ── reopen: take a decision back ────────────────────────────────────────────
    [Fact] public async Task Reopen_PutsARejectedExpenseBackToPending_AndItCanBeApproved()
    {
        var db = NewDb();
        var e = await Add(db);
        await new RejectLedgerEntryHandler(db, Me()).Handle(new RejectLedgerEntryCommand(e.Id, "Not budgeted"), default);

        (await new ReopenLedgerEntryHandler(db, Me()).Handle(new ReopenLedgerEntryCommand(e.Id), default)).IsSuccess.Should().BeTrue();

        var row = await db.LedgerEntries.SingleAsync();
        (row.Status, row.RejectionReason, row.ApprovedBy).Should().Be((ApprovalStatus.PendingApproval, null, null));
        (await new ApproveLedgerEntryHandler(db, Me()).Handle(new ApproveLedgerEntryCommand(e.Id), default)).IsSuccess.Should().BeTrue();
    }

    [Fact] public async Task Reopen_AnApprovedExpense_Works_ButNotOneAlreadyPending_OrIncome()
    {
        var db = NewDb();
        var big = await Add(db);
        await new ApproveLedgerEntryHandler(db, Me()).Handle(new ApproveLedgerEntryCommand(big.Id), default);
        var h = new ReopenLedgerEntryHandler(db, Me());

        (await h.Handle(new ReopenLedgerEntryCommand(big.Id), default)).IsSuccess.Should().BeTrue();
        (await h.Handle(new ReopenLedgerEntryCommand(big.Id), default)).Error!.Code.Should().Be("ENTRY.ALREADY_PENDING");

        var income = await Add(db, EntryType.Income);
        (await h.Handle(new ReopenLedgerEntryCommand(income.Id), default)).Error!.Code.Should().Be("ENTRY.NOT_EXPENSE");
    }

    // ── edit ────────────────────────────────────────────────────────────────────
    [Fact] public async Task Edit_FixesTheDescriptionAndDate_WithoutRestartingApproval()
    {
        var db = NewDb();
        var e = await Add(db);
        await new ApproveLedgerEntryHandler(db, Me()).Handle(new ApproveLedgerEntryCommand(e.Id), default);

        var r = await new EditLedgerEntryHandler(db, Me()).Handle(new EditLedgerEntryCommand(e.Id, "utilities", "Lift AMC Oct", 5_000_000, new DateOnly(2026, 10, 1)), default);

        r.IsSuccess.Should().BeTrue();
        var row = await db.LedgerEntries.SingleAsync();
        (row.Category, row.Description, row.EntryDate, row.Status).Should().Be(("utilities", "Lift AMC Oct", new DateOnly(2026, 10, 1), ApprovalStatus.Approved));
    }

    [Fact] public async Task Edit_ToABiggerAmount_SendsItBackForApproval_ToASmallerOne_ApprovesIt()
    {
        var db = NewDb();
        var small = await Add(db, paise: 500_000);                      // ₹5,000: auto-approved
        small.Status.Should().Be(ApprovalStatus.Approved);

        await new EditLedgerEntryHandler(db, Me()).Handle(new EditLedgerEntryCommand(small.Id, "maintenance", "Lift AMC", 2_000_000, small.EntryDate), default);
        (await db.LedgerEntries.SingleAsync()).Status.Should().Be(ApprovalStatus.PendingApproval);   // now ₹20,000

        await new EditLedgerEntryHandler(db, Me()).Handle(new EditLedgerEntryCommand(small.Id, "maintenance", "Lift AMC", 800_000, small.EntryDate), default);
        (await db.LedgerEntries.SingleAsync()).Status.Should().Be(ApprovalStatus.Approved);          // ₹8,000
    }

    [Fact] public async Task Edit_OfARejectedEntry_ResubmitsIt()
    {
        var db = NewDb();
        var e = await Add(db);
        await new RejectLedgerEntryHandler(db, Me()).Handle(new RejectLedgerEntryCommand(e.Id, "Wrong amount"), default);

        await new EditLedgerEntryHandler(db, Me()).Handle(new EditLedgerEntryCommand(e.Id, "maintenance", "Lift AMC", 4_000_000, e.EntryDate), default);

        var row = await db.LedgerEntries.SingleAsync();
        (row.Status, row.RejectionReason).Should().Be((ApprovalStatus.PendingApproval, null));
    }

    [Fact] public void Edit_RejectsEmptyTextAndNonPositiveAmounts()
    {
        var v = new EditLedgerEntryValidator();
        v.Validate(new EditLedgerEntryCommand(Guid.NewGuid(), "x", "", 100, new DateOnly(2026, 1, 1))).IsValid.Should().BeFalse();
        v.Validate(new EditLedgerEntryCommand(Guid.NewGuid(), "x", "y", 0, new DateOnly(2026, 1, 1))).IsValid.Should().BeFalse();
        v.Validate(new EditLedgerEntryCommand(Guid.NewGuid(), "x", "y", 100, new DateOnly(2026, 1, 1))).IsValid.Should().BeTrue();
    }

    // ── delete ──────────────────────────────────────────────────────────────────
    [Fact] public async Task Delete_HidesTheEntry_FromTheLedgerAndTheReport_ButKeepsTheRow()
    {
        var db = NewDb();
        var e = await Add(db, paise: 500_000);   // approved small expense counted in the report

        (await new DeleteLedgerEntryHandler(db, Me()).Handle(new DeleteLedgerEntryCommand(e.Id), default)).IsSuccess.Should().BeTrue();

        var list = await new GetLedgerEntriesHandler(db, Me()).Handle(new GetLedgerEntriesQuery(Month: 10, Year: 2026), default);
        list.Value!.Items.Should().BeEmpty();
        var report = await new GetMonthlyReportHandler(db, Me()).Handle(new GetMonthlyReportQuery(10, 2026), default);
        report.Value!.TotalExpensePaise.Should().Be(0);
        (await db.LedgerEntries.IgnoreQueryFilters().CountAsync()).Should().Be(1);
    }

    [Fact] public async Task ListShowsAllStatuses_AndTheRejectionReason()
    {
        var db = NewDb();
        var e = await Add(db);
        await new RejectLedgerEntryHandler(db, Me()).Handle(new RejectLedgerEntryCommand(e.Id, "Not budgeted"), default);

        var list = (await new GetLedgerEntriesHandler(db, Me()).Handle(new GetLedgerEntriesQuery(Month: 10, Year: 2026), default)).Value!;

        list.Items.Should().ContainSingle(x => x.Status == "Rejected" && x.RejectionReason == "Not budgeted");
    }

    // ── who may do it ───────────────────────────────────────────────────────────
    [Fact] public async Task NonAdmins_CannotEditReopenOrDelete()
    {
        var db = NewDb();
        var e = await Add(db);
        await new RejectLedgerEntryHandler(db, Me()).Handle(new RejectLedgerEntryCommand(e.Id, "No"), default);
        var accountant = Me(admin: false);

        (await new EditLedgerEntryHandler(db, accountant).Handle(new EditLedgerEntryCommand(e.Id, "x", "Changed", 100, e.EntryDate), default)).IsSuccess.Should().BeFalse();
        (await new ReopenLedgerEntryHandler(db, accountant).Handle(new ReopenLedgerEntryCommand(e.Id), default)).IsSuccess.Should().BeFalse();
        (await new DeleteLedgerEntryHandler(db, accountant).Handle(new DeleteLedgerEntryCommand(e.Id), default)).IsSuccess.Should().BeFalse();
        var row = await db.LedgerEntries.SingleAsync();
        (row.Description, row.Status, row.IsDeleted).Should().Be(("Lift AMC", ApprovalStatus.Rejected, false));
    }

    [Fact] public async Task AnotherSocietysAdmin_CannotTouchTheseEntries()
    {
        var db = NewDb();
        var e = await Add(db);
        var stranger = Me(society: Guid.NewGuid());
        (await new DeleteLedgerEntryHandler(db, stranger).Handle(new DeleteLedgerEntryCommand(e.Id), default)).Error!.Code.Should().Be("ENTRY.NOT_FOUND");
        (await new ReopenLedgerEntryHandler(db, stranger).Handle(new ReopenLedgerEntryCommand(e.Id), default)).Error!.Code.Should().Be("ENTRY.NOT_FOUND");
    }

    [Fact] public async Task PendingApprovals_AreListedWhateverMonthTheyAreDated()
    {
        var db = NewDb();
        await Add(db);                                                   // Oct 2026, pending (₹50,000)
        var list = await new GetLedgerEntriesHandler(db, Me()).Handle(new GetLedgerEntriesQuery(Month: 3, Year: 2025, PendingOnly: true), default);
        list.Value!.Items.Should().ContainSingle(x => x.Status == "PendingApproval");

        var otherMonth = await new GetLedgerEntriesHandler(db, Me()).Handle(new GetLedgerEntriesQuery(Month: 3, Year: 2025), default);
        otherMonth.Value!.Items.Should().BeEmpty();                      // the normal list is still per month
    }
}
