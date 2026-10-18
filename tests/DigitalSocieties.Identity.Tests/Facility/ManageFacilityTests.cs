using Xunit;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Facility.Application.Commands;
using DigitalSocieties.Facility.Infrastructure.Persistence;
using FacilityEntity = DigitalSocieties.Facility.Domain.Entities.Facility;

namespace DigitalSocieties.Identity.Tests.Facility;

public class ManageFacilityTests
{
    private static readonly Guid Society = Guid.NewGuid();

    private static FacilityDbContext NewDb()
        => new(new DbContextOptionsBuilder<FacilityDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static ICurrentUser Admin(Guid? society = null)
    {
        var cu = Substitute.For<ICurrentUser>();
        cu.SocietyId.Returns(society ?? Society);
        return cu;
    }

    private static FacilityDetails Clubhouse(string name = "Clubhouse") =>
        new(name, "Party hall", 50, 60, new TimeOnly(8, 0), new TimeOnly(22, 0), 14, 3);

    [Fact] public async Task Create_SavesFacility_InTheAdminsSociety_WithAllSettings()
    {
        var db = NewDb();
        var r = await new CreateFacilityHandler(db, Admin()).Handle(new CreateFacilityCommand(Clubhouse()), default);

        r.IsSuccess.Should().BeTrue();
        var f = await db.Facilities.SingleAsync();
        (f.SocietyId, f.Name, f.IsActive).Should().Be((Society, "Clubhouse", true));
        (f.CapacityPersons, f.SlotDurationMinutes, f.AdvanceBookingDays, f.MaxBookingsPerFlat).Should().Be((50, 60, 14, 3));
        (f.OpenTime, f.CloseTime).Should().Be((new TimeOnly(8, 0), new TimeOnly(22, 0)));
    }

    [Fact] public async Task Create_RejectsDuplicateName_InTheSameSociety()
    {
        var db = NewDb();
        var h = new CreateFacilityHandler(db, Admin());
        await h.Handle(new CreateFacilityCommand(Clubhouse()), default);
        var r = await h.Handle(new CreateFacilityCommand(Clubhouse()), default);
        r.IsSuccess.Should().BeFalse();
        r.Error!.Code.Should().Be("FACILITY.DUPLICATE");
        (await db.Facilities.CountAsync()).Should().Be(1);
    }

    [Fact] public async Task Update_ChangesTheFacility_ButNotAnotherSocietys()
    {
        var db = NewDb();
        var id = (await new CreateFacilityHandler(db, Admin()).Handle(new CreateFacilityCommand(Clubhouse()), default)).Value;

        var ok = await new UpdateFacilityHandler(db, Admin()).Handle(
            new UpdateFacilityCommand(id, Clubhouse("Party Hall") with { CapacityPersons = 80 }), default);
        ok.IsSuccess.Should().BeTrue();
        var f = await db.Facilities.SingleAsync();
        (f.Name, f.CapacityPersons).Should().Be(("Party Hall", 80));

        var other = await new UpdateFacilityHandler(db, Admin(Guid.NewGuid())).Handle(new UpdateFacilityCommand(id, Clubhouse("Hijack")), default);
        other.IsSuccess.Should().BeFalse();
        (await db.Facilities.SingleAsync()).Name.Should().Be("Party Hall");
    }

    [Fact] public async Task SwitchOff_HidesFromResidents_AndSwitchOn_RestoresIt()
    {
        var db = NewDb();
        var id = (await new CreateFacilityHandler(db, Admin()).Handle(new CreateFacilityCommand(Clubhouse()), default)).Value;

        await new SetFacilityActiveHandler(db, Admin()).Handle(new SetFacilityActiveCommand(id, false), default);
        (await db.Facilities.SingleAsync()).IsActive.Should().BeFalse();

        await new SetFacilityActiveHandler(db, Admin()).Handle(new SetFacilityActiveCommand(id, true), default);
        (await db.Facilities.SingleAsync()).IsActive.Should().BeTrue();
    }

    [Fact] public async Task SwitchOff_OfAnotherSocietysFacility_IsRefused()
    {
        var db = NewDb();
        var id = (await new CreateFacilityHandler(db, Admin()).Handle(new CreateFacilityCommand(Clubhouse()), default)).Value;
        var r = await new SetFacilityActiveHandler(db, Admin(Guid.NewGuid())).Handle(new SetFacilityActiveCommand(id, false), default);
        r.IsSuccess.Should().BeFalse();
        (await db.Facilities.SingleAsync()).IsActive.Should().BeTrue();
    }

    [Theory]
    [InlineData("", 10, 60, 8, 22)]          // no name
    [InlineData("Gym", 0, 60, 8, 22)]        // no capacity
    [InlineData("Gym", 10, 10, 8, 22)]       // slot shorter than 15 minutes
    [InlineData("Gym", 10, 60, 22, 8)]       // closes before it opens
    [InlineData("Gym", 10, 120, 8, 9)]       // hours too short for one slot
    public void Validator_RejectsNonsenseSettings(string name, int cap, int slot, int openH, int closeH)
    {
        var d = new FacilityDetails(name, "", cap, slot, new TimeOnly(openH, 0), new TimeOnly(closeH, 0));
        new CreateFacilityValidator().Validate(new CreateFacilityCommand(d)).IsValid.Should().BeFalse();
    }

    [Fact] public void Validator_AcceptsSensibleSettings()
        => new CreateFacilityValidator().Validate(new CreateFacilityCommand(Clubhouse())).IsValid.Should().BeTrue();
}
