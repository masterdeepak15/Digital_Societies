using Xunit;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Marketplace.Application.Commands;
using DigitalSocieties.Marketplace.Application.Queries;
using DigitalSocieties.Marketplace.Infrastructure.Persistence;

namespace DigitalSocieties.Identity.Tests.Marketplace;

/// <summary>A resident can register a service person, but it only reaches the Services list once an admin approves it.</summary>
public class ServiceApprovalTests
{
    private static readonly Guid Society = Guid.NewGuid();
    private static readonly Guid Asha    = Guid.NewGuid();   // the resident who registers
    private static readonly Guid Bhaskar = Guid.NewGuid();   // another resident
    private static readonly Guid Admin   = Guid.NewGuid();

    private static MarketplaceDbContext NewDb()
        => new(new DbContextOptionsBuilder<MarketplaceDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static ICurrentUser As(Guid user, bool admin = false, Guid? society = null)
    {
        var cu = Substitute.For<ICurrentUser>();
        cu.SocietyId.Returns(society ?? Society);
        cu.UserId.Returns(user);
        cu.FlatId.Returns(Guid.NewGuid());
        cu.IsInRole("admin").Returns(admin);
        return cu;
    }

    private static CreateListingCommand Plumber(decimal commission = 10m) =>
        new("Ramesh Kale", "+919975001173", "Plumber", "Leak repair", "Taps, pipes, tanks", 350m, "PerVisit", commission);

    private static async Task<Guid> Register(MarketplaceDbContext db, Guid user, decimal commission = 10m)
        => (await new CreateListingHandler(db, As(user)).Handle(Plumber(commission), default)).Value;

    private static Task<IReadOnlyList<ListingDto>> Seen(MarketplaceDbContext db, ICurrentUser who, string? approval = null, bool all = false)
        => new GetListingsHandler(db, who).Handle(new GetListingsQuery(null, 1, 50, all, approval), default)
            .ContinueWith(t => (IReadOnlyList<ListingDto>)t.Result.Value!);

    [Fact] public async Task AResidentsRegistration_WaitsForApproval()
    {
        var db = NewDb();
        await Register(db, Asha);
        (await db.ServiceListings.SingleAsync()).Approval.ToString().Should().Be("Pending");
    }

    [Fact] public async Task AnAdminsListing_IsApprovedStraightAway()
    {
        var db = NewDb();
        await new CreateListingHandler(db, As(Admin, admin: true)).Handle(Plumber(), default);
        (await db.ServiceListings.SingleAsync()).Approval.ToString().Should().Be("Approved");
    }

    [Fact] public async Task AResident_CannotChooseTheirOwnCommission()
    {
        var db = NewDb();
        await Register(db, Asha, commission: 0m);
        (await db.ServiceListings.SingleAsync()).CommissionPct.Should().Be(10m);
    }

    [Fact] public async Task AWaitingListing_IsHiddenFromOtherResidents_ButVisibleToItsOwner()
    {
        var db = NewDb();
        await Register(db, Asha);

        (await Seen(db, As(Bhaskar))).Should().BeEmpty();
        var mine = await Seen(db, As(Asha));
        mine.Should().ContainSingle();
        (mine[0].Approval, mine[0].IsMine).Should().Be(("Pending", true));
    }

    [Fact] public async Task TheAdmin_CanListWhatIsWaiting()
    {
        var db = NewDb();
        await Register(db, Asha);

        (await Seen(db, As(Admin, admin: true))).Should().BeEmpty();                       // not in the normal list
        (await Seen(db, As(Admin, admin: true), approval: "Pending")).Should().ContainSingle();
        (await Seen(db, As(Bhaskar), approval: "Pending")).Should().BeEmpty();             // the filter gives a resident nothing extra
    }

    [Fact] public async Task Approving_ShowsItToEveryone()
    {
        var db = NewDb();
        var id = await Register(db, Asha);

        var done = await new ApproveListingHandler(db, As(Admin, admin: true)).Handle(new ApproveListingCommand(id), default);

        done.IsSuccess.Should().BeTrue();
        (await Seen(db, As(Bhaskar))).Should().ContainSingle(x => x.Approval == "Approved");
    }

    [Fact] public async Task OnlyAnAdmin_CanApproveOrReject()
    {
        var db = NewDb();
        var id = await Register(db, Asha);

        (await new ApproveListingHandler(db, As(Bhaskar)).Handle(new ApproveListingCommand(id), default)).Error!.Code.Should().Be("FORBIDDEN");
        (await new RejectListingHandler(db, As(Asha)).Handle(new RejectListingCommand(id, "Fine"), default)).Error!.Code.Should().Be("FORBIDDEN");
        (await db.ServiceListings.SingleAsync()).Approval.ToString().Should().Be("Pending");
    }

    [Fact] public async Task AnAdminOfAnotherSociety_CannotDecide()
    {
        var db = NewDb();
        var id = await Register(db, Asha);

        var r = await new ApproveListingHandler(db, As(Admin, admin: true, society: Guid.NewGuid())).Handle(new ApproveListingCommand(id), default);

        r.Error!.Code.Should().Be("LISTING.NOT_FOUND");
    }

    [Fact] public async Task Rejecting_NeedsAReason_AndTheOwnerCanSeeIt()
    {
        var db = NewDb();
        var id = await Register(db, Asha);
        var admin = As(Admin, admin: true);

        new RejectListingValidator().Validate(new RejectListingCommand(id, "  ")).IsValid.Should().BeFalse();

        (await new RejectListingHandler(db, admin).Handle(new RejectListingCommand(id, "Phone number is not reachable"), default)).IsSuccess.Should().BeTrue();

        var mine = await Seen(db, As(Asha));
        (mine[0].Approval, mine[0].RejectionReason).Should().Be(("Rejected", "Phone number is not reachable"));
        (await Seen(db, As(Bhaskar))).Should().BeEmpty();
    }

    [Fact] public async Task ARejectedListing_CanBeApprovedLater()
    {
        var db = NewDb();
        var id = await Register(db, Asha);
        var admin = As(Admin, admin: true);
        await new RejectListingHandler(db, admin).Handle(new RejectListingCommand(id, "Missing details"), default);

        (await new ApproveListingHandler(db, admin).Handle(new ApproveListingCommand(id), default)).IsSuccess.Should().BeTrue();

        var l = await db.ServiceListings.SingleAsync();
        (l.Approval.ToString(), l.RejectionReason).Should().Be(("Approved", null));
    }

    [Fact] public async Task ABookingCannotBeMade_OnAListingThatIsNotApproved()
    {
        var db = NewDb();
        var id = await Register(db, Asha);

        var r = await new BookServiceHandler(db, As(Bhaskar)).Handle(new BookServiceCommand(id, DateTimeOffset.UtcNow.AddDays(1), 350m, null), default);

        r.Error!.Code.Should().Be("LISTING.NOT_FOUND");
        (await db.ServiceBookings.CountAsync()).Should().Be(0);
    }

    [Fact] public async Task TheOwner_CanEditTheirListing_ButItGoesBackForApproval()
    {
        var db = NewDb();
        var id = await Register(db, Asha);
        await new ApproveListingHandler(db, As(Admin, admin: true)).Handle(new ApproveListingCommand(id), default);

        var edit = new UpdateListingCommand(id, "Ramesh K.", "9975001199", "Plumber", "Leak repair", "Now also bathrooms", 400m, "PerVisit", 0m);
        (await new UpdateListingHandler(db, As(Asha)).Handle(edit, default)).IsSuccess.Should().BeTrue();

        var l = await db.ServiceListings.SingleAsync();
        (l.Approval.ToString(), l.Description, l.CommissionPct).Should().Be(("Pending", "Now also bathrooms", 10m));
        (await Seen(db, As(Bhaskar))).Should().BeEmpty();
    }

    [Fact] public async Task AnotherResident_CannotEditOrDeleteSomeoneElsesListing()
    {
        var db = NewDb();
        var id = await Register(db, Asha);

        var edit = new UpdateListingCommand(id, "X", "9975001199", "Plumber", "Hijack", "", 1m, "PerVisit", 0m);
        (await new UpdateListingHandler(db, As(Bhaskar)).Handle(edit, default)).Error!.Code.Should().Be("FORBIDDEN");
        (await new DeleteListingHandler(db, As(Bhaskar)).Handle(new DeleteListingCommand(id), default)).Error!.Code.Should().Be("FORBIDDEN");
        (await db.ServiceListings.SingleAsync()).Title.Should().Be("Leak repair");
    }

    [Fact] public async Task TheOwner_CanWithdrawTheirListing()
    {
        var db = NewDb();
        var id = await Register(db, Asha);

        (await new DeleteListingHandler(db, As(Asha)).Handle(new DeleteListingCommand(id), default)).IsSuccess.Should().BeTrue();

        (await Seen(db, As(Asha))).Should().BeEmpty();
    }

    [Fact] public async Task AnAdminsEdit_KeepsTheApproval()
    {
        var db = NewDb();
        var id = (await new CreateListingHandler(db, As(Admin, admin: true)).Handle(Plumber(), default)).Value;

        var edit = new UpdateListingCommand(id, "Ramesh K.", "9975001199", "Plumber", "Leak repair", "", 400m, "PerVisit", 5m);
        await new UpdateListingHandler(db, As(Admin, admin: true)).Handle(edit, default);

        (await db.ServiceListings.SingleAsync()).Approval.ToString().Should().Be("Approved");
    }
}
