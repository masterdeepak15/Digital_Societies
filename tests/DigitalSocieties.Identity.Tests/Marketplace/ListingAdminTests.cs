using Xunit;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Marketplace.Application.Commands;
using DigitalSocieties.Marketplace.Application.Queries;
using DigitalSocieties.Marketplace.Infrastructure.Persistence;

namespace DigitalSocieties.Identity.Tests.Marketplace;

public class ListingAdminTests
{
    private static readonly Guid Society = Guid.NewGuid();

    private static MarketplaceDbContext NewDb()
        => new(new DbContextOptionsBuilder<MarketplaceDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static ICurrentUser User(bool admin, Guid? society = null)
    {
        var cu = Substitute.For<ICurrentUser>();
        cu.SocietyId.Returns(society ?? Society);
        cu.UserId.Returns(Guid.NewGuid());
        cu.IsInRole("admin").Returns(admin);
        return cu;
    }

    private static CreateListingCommand Plumber(string phone = "+919975001173") =>
        new("Ramesh Kale", phone, "Plumber", "Leak repair", "Taps, pipes, tanks", 350m, "PerVisit", 10m);

    private static async Task<Guid> Add(MarketplaceDbContext db)
        => (await new CreateListingHandler(db, User(true)).Handle(Plumber(), default)).Value;

    [Fact] public async Task Create_SavesActiveListing_InTheAdminsSociety()
    {
        var db = NewDb();
        await Add(db);
        var l = await db.ServiceListings.SingleAsync();
        (l.SocietyId, l.Title, l.IsActive, l.BaseRate.Amount).Should().Be((Society, "Leak repair", true, 350m));
    }

    [Fact] public async Task Residents_SeeOnlyActive_AdminsCanAskForAll()
    {
        var db = NewDb();
        var id = await Add(db);
        await new SetListingActiveHandler(db, User(true)).Handle(new SetListingActiveCommand(id, false), default);

        var resident = await new GetListingsHandler(db, User(false)).Handle(new GetListingsQuery(null, 1, 20, IncludeInactive: true), default);
        resident.Value.Should().BeEmpty();                       // asking for inactive does nothing for a resident

        var admin = await new GetListingsHandler(db, User(true)).Handle(new GetListingsQuery(null, 1, 20, IncludeInactive: true), default);
        admin.Value.Should().ContainSingle(x => !x.IsActive);

        var adminDefault = await new GetListingsHandler(db, User(true)).Handle(new GetListingsQuery(null, 1, 20), default);
        adminDefault.Value.Should().BeEmpty();
    }

    [Fact] public async Task SwitchOn_BringsTheListingBack()
    {
        var db = NewDb();
        var id = await Add(db);
        await new SetListingActiveHandler(db, User(true)).Handle(new SetListingActiveCommand(id, false), default);
        await new SetListingActiveHandler(db, User(true)).Handle(new SetListingActiveCommand(id, true), default);
        (await db.ServiceListings.SingleAsync()).IsActive.Should().BeTrue();
    }

    [Fact] public async Task SwitchOff_OfAnotherSocietysListing_IsRefused()
    {
        var db = NewDb();
        var id = await Add(db);
        var r = await new SetListingActiveHandler(db, User(true, Guid.NewGuid())).Handle(new SetListingActiveCommand(id, false), default);
        r.IsSuccess.Should().BeFalse();
        (await db.ServiceListings.SingleAsync()).IsActive.Should().BeTrue();
    }

    [Theory]
    [InlineData("9975001173", true)]
    [InlineData("+919975001173", true)]
    [InlineData("12345", false)]
    [InlineData("call me", false)]
    public void Validator_ChecksThePhoneNumber(string phone, bool valid)
        => new CreateListingValidator().Validate(Plumber(phone)).IsValid.Should().Be(valid);

    [Fact] public void Validator_RejectsFreeRatesAndImpossibleCommission()
    {
        new CreateListingValidator().Validate(Plumber() with { BaseRateRupees = 0 }).IsValid.Should().BeFalse();
        new CreateListingValidator().Validate(Plumber() with { CommissionPct = 120 }).IsValid.Should().BeFalse();
    }
}
