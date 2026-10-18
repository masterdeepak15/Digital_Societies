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

    [Fact] public async Task Update_ChangesTheListing_AndRejectsBadValues()
    {
        var db = NewDb();
        var id = await Add(db);
        var h = new UpdateListingHandler(db, User(true));

        var ok = await h.Handle(new UpdateListingCommand(id, "Ramesh K.", "9975001199", "Electrician", "Wiring", "Fans and lights", 500m, "PerHour", 5m), default);
        ok.IsSuccess.Should().BeTrue();
        var l = await db.ServiceListings.SingleAsync();
        (l.ProviderName, l.Category.ToString(), l.Title, l.BaseRate.Amount, l.RateUnit.ToString(), l.CommissionPct)
            .Should().Be(("Ramesh K.", "Electrician", "Wiring", 500m, "PerHour", 5m));

        (await h.Handle(new UpdateListingCommand(id, "R", "9975001199", "Nonsense", "T", "", 500m, "PerHour", 5m), default)).Error!.Code.Should().Be("LISTING.INVALID_CATEGORY");
        (await db.ServiceListings.SingleAsync()).Title.Should().Be("Wiring");
    }

    [Fact] public async Task Update_FromAnotherSociety_IsRefused()
    {
        var db = NewDb();
        var id = await Add(db);
        var r = await new UpdateListingHandler(db, User(true, Guid.NewGuid())).Handle(
            new UpdateListingCommand(id, "X", "9975001199", "Plumber", "Hijack", "", 1m, "PerVisit", 0m), default);
        r.IsSuccess.Should().BeFalse();
        (await db.ServiceListings.SingleAsync()).Title.Should().Be("Leak repair");
    }

    [Fact] public async Task Delete_RemovesTheListing_ForEveryone()
    {
        var db = NewDb();
        var id = await Add(db);
        (await new DeleteListingHandler(db, User(true)).Handle(new DeleteListingCommand(id), default)).IsSuccess.Should().BeTrue();

        (await db.ServiceListings.CountAsync()).Should().Be(0);
        var admin = await new GetListingsHandler(db, User(true)).Handle(new GetListingsQuery(null, 1, 20, IncludeInactive: true), default);
        admin.Value.Should().BeEmpty();
    }

    [Fact] public async Task Delete_IsRefused_WhileABookingIsOpen()
    {
        var db = NewDb();
        var id = await Add(db);
        db.ServiceBookings.Add(DigitalSocieties.Marketplace.Domain.Entities.ServiceBooking.Create(
            Society, id, Guid.NewGuid(), Guid.NewGuid(), DateTimeOffset.UtcNow.AddDays(1),
            DigitalSocieties.Shared.Domain.ValueObjects.Money.CreateInr(350m).Value!));
        await db.SaveChangesAsync();

        var r = await new DeleteListingHandler(db, User(true)).Handle(new DeleteListingCommand(id), default);
        r.Error!.Code.Should().Be("LISTING.HAS_BOOKINGS");
        (await db.ServiceListings.CountAsync()).Should().Be(1);
    }
}
