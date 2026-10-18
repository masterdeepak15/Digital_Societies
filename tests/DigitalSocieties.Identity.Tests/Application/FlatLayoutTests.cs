using Xunit;
using FluentAssertions;
using NSubstitute;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Identity.Application.Commands;
using DigitalSocieties.Identity.Domain.Entities;
using DigitalSocieties.Identity.Infrastructure.Persistence;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Domain;
using DigitalSocieties.Shared.Domain.ValueObjects;

namespace DigitalSocieties.Identity.Tests.Application;

public class FlatLayoutTests
{
    private readonly Society _society = Society.Create("Govindbaug Society", "Dehugaon, Pune 412109", "NA");
    private readonly IdentityDbContext _db;

    public FlatLayoutTests()
    {
        _db = new IdentityDbContext(
            new DbContextOptionsBuilder<IdentityDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options,
            Substitute.For<ICurrentUser>());
        _db.Societies.Add(_society);
        _db.SaveChanges();
    }

    private Flat NewFlat(string number, string wing, int floor)
    {
        var flat = Flat.Create(_society.Id, number, wing, floor);
        _db.Flats.Add(flat);
        return flat;
    }

    private ICurrentUser Me(bool admin = true, Guid? society = null)
    {
        var cu = Substitute.For<ICurrentUser>();
        cu.SocietyId.Returns(society ?? _society.Id);
        cu.UserId.Returns(Guid.NewGuid());
        cu.IsInRole("admin").Returns(admin);
        return cu;
    }

    private Task<DigitalSocieties.Shared.Results.Result<FlatLayoutResult>> Layout(
        string[] wings, int floors, int perFloor, bool removeOthers = false, bool admin = true)
        => new ConfigureFlatLayoutHandler(_db, Me(admin)).Handle(new(wings, floors, perFloor, removeOthers), default);

    // ── the label rule ──────────────────────────────────────────────────────────
    [Theory]
    [InlineData("A", "807", "A-807")]
    [InlineData("A", "A-807", "A-807")]      // number already carries the wing: no "A-A-807"
    [InlineData("a", "A-101", "A-101")]
    [InlineData("B", "B2", "B-B2")]          // only "B-" counts as the wing prefix
    [InlineData(null, "101", "101")]
    [InlineData("", " 101 ", "101")]
    public void FlatLabel_NeverRepeatsTheWing(string? wing, string number, string expected)
        => FlatLabel.Of(wing, number).Should().Be(expected);

    // ── the layout ──────────────────────────────────────────────────────────────
    [Fact] public async Task OneWing_8Floors_8FlatsEach_Makes64Flats_A101_To_A808()
    {
        var r = await Layout(["A"], 8, 8);

        r.IsSuccess.Should().BeTrue();
        r.Value.Should().Be(new FlatLayoutResult(Created: 64, Kept: 0, Removed: 0, OutsideLayoutStillInUse: 0, Total: 64));
        var labels = (await _db.Flats.ToListAsync()).Select(f => f.DisplayName).ToHashSet();
        labels.Should().HaveCount(64).And.Contain(["A-101", "A-108", "A-807", "A-808"]);
        (await _db.Societies.SingleAsync()).TotalFlats.Should().Be(64);
    }

    [Fact] public async Task TwoWings_GetTheirOwnFlats()
    {
        await Layout(["A", "B"], 2, 3);
        (await _db.Flats.CountAsync()).Should().Be(12);
        (await _db.Flats.Where(f => f.Wing == "B").Select(f => f.Number).ToListAsync())
            .Should().BeEquivalentTo(["101", "102", "103", "201", "202", "203"]);
    }

    [Fact] public async Task RunningItAgain_AddsNothing()
    {
        await Layout(["A"], 8, 8);
        var again = await Layout(["A"], 8, 8);
        again.Value.Should().Be(new FlatLayoutResult(0, 64, 0, 0, 64));
        (await _db.Flats.CountAsync()).Should().Be(64);
    }

    [Fact] public async Task GrowingTheBuilding_OnlyAddsTheNewFlats()
    {
        await Layout(["A"], 2, 2);
        var r = await Layout(["A"], 3, 2);
        (r.Value!.Created, r.Value.Kept, r.Value.Total).Should().Be((2, 4, 6));
    }

    [Fact] public async Task OldStyleNumbers_LikeA101_AreRecognised_NotDuplicated()
    {
        NewFlat("A-101", "A", 1);          // how the old setup wrote it
        await _db.SaveChangesAsync();

        var r = await Layout(["A"], 1, 2);

        r.Value!.Created.Should().Be(1);            // only A-102 is new
        (await _db.Flats.CountAsync()).Should().Be(2);
    }

    [Fact] public async Task RemoveOthers_DropsEmptyFlatsOutsideTheLayout_ButKeepsOccupiedOnes()
    {
        var empty    = NewFlat("A-701", "A", 7);
        var occupied = NewFlat("A-702", "A", 7);
        await _db.SaveChangesAsync();
        _db.Memberships.Add(Membership.Create(Guid.NewGuid(), _society.Id, "resident", occupied.Id, "owner"));
        await _db.SaveChangesAsync();

        var r = await Layout(["A"], 1, 2, removeOthers: true);

        r.Value!.Removed.Should().Be(1);
        r.Value.OutsideLayoutStillInUse.Should().Be(1);
        (await _db.Flats.SingleAsync(f => f.Id == empty.Id)).IsDeleted.Should().BeTrue();
        (await _db.Flats.SingleAsync(f => f.Id == occupied.Id)).IsDeleted.Should().BeFalse();
    }

    [Fact] public async Task WithoutRemoveOthers_ExistingFlatsAreLeftAlone()
    {
        NewFlat("A-701", "A", 7);
        await _db.SaveChangesAsync();
        var r = await Layout(["A"], 1, 1);
        r.Value!.Removed.Should().Be(0);
        (await _db.Flats.CountAsync(f => !f.IsDeleted)).Should().Be(2);
    }

    [Fact] public async Task NonAdmin_CannotChangeTheFlats()
    {
        var r = await Layout(["A"], 2, 2, admin: false);
        r.IsSuccess.Should().BeFalse();
        (await _db.Flats.CountAsync()).Should().Be(0);
    }

    [Theory]
    [InlineData(0, 8)] [InlineData(61, 8)] [InlineData(8, 0)] [InlineData(8, 51)]
    public void Validator_RejectsImpossibleSizes(int floors, int perFloor)
        => new ConfigureFlatLayoutValidator().Validate(new ConfigureFlatLayoutCommand(["A"], floors, perFloor)).IsValid.Should().BeFalse();

    [Fact] public void Validator_NeedsAWing()
        => new ConfigureFlatLayoutValidator().Validate(new ConfigureFlatLayoutCommand([], 8, 8)).IsValid.Should().BeFalse();

    // ── single flats ────────────────────────────────────────────────────────────
    [Fact] public async Task AddFlat_AddsOne_AndRefusesADuplicate_EvenInOldStyle()
    {
        var h = new AddFlatHandler(_db, Me());
        (await h.Handle(new("A", "807", 8), default)).IsSuccess.Should().BeTrue();
        (await h.Handle(new("a", "A-807", 8), default)).Error!.Code.Should().Be("FLAT.EXISTS");
        (await _db.Societies.SingleAsync()).TotalFlats.Should().Be(1);
    }

    [Fact] public async Task DeleteFlat_RefusedWhileSomeoneLivesThere_AllowedWhenEmpty()
    {
        var flat = NewFlat("807", "A", 8);
        await _db.SaveChangesAsync();
        _db.Memberships.Add(Membership.Create(Guid.NewGuid(), _society.Id, "resident", flat.Id, "owner"));
        await _db.SaveChangesAsync();

        var h = new DeleteFlatHandler(_db, Me());
        (await h.Handle(new DeleteFlatCommand(flat.Id), default)).Error!.Code.Should().Be("FLAT.IN_USE");

        foreach (var m in _db.Memberships) m.Revoke();
        await _db.SaveChangesAsync();
        (await h.Handle(new DeleteFlatCommand(flat.Id), default)).IsSuccess.Should().BeTrue();
        (await _db.Societies.SingleAsync()).TotalFlats.Should().Be(0);
    }

    [Fact] public async Task GetFlats_ListsLabelsInOrder_WithResidentCounts()
    {
        await Layout(["A"], 2, 2);
        var f = await _db.Flats.FirstAsync(x => x.Number == "102");
        _db.Memberships.Add(Membership.Create(Guid.NewGuid(), _society.Id, "resident", f.Id, "owner"));
        await _db.SaveChangesAsync();

        var list = (await new GetFlatsHandler(_db, Me()).Handle(new GetFlatsQuery(), default)).Value!;

        list.Select(x => x.Label).Should().Equal("A-101", "A-102", "A-201", "A-202");
        list.Single(x => x.Label == "A-102").Residents.Should().Be(1);
    }

    [Fact] public async Task AnotherSociety_CannotSeeOrTouchTheseFlats()
    {
        await Layout(["A"], 1, 2);
        var other = Me(society: Guid.NewGuid());
        (await new GetFlatsHandler(_db, other).Handle(new GetFlatsQuery(), default)).Value.Should().BeEmpty();
        var id = (await _db.Flats.FirstAsync()).Id;
        (await new DeleteFlatHandler(_db, other).Handle(new DeleteFlatCommand(id), default)).IsSuccess.Should().BeFalse();
    }

    [Fact] public async Task UpdateFlat_FixesNumberAndFloor_ButNotIntoAnExistingFlat()
    {
        var a = NewFlat("807", "A", 8);
        NewFlat("808", "A", 8);
        await _db.SaveChangesAsync();
        var h = new UpdateFlatHandler(_db, Me());

        (await h.Handle(new UpdateFlatCommand(a.Id, "A", "809", 8), default)).IsSuccess.Should().BeTrue();
        (await _db.Flats.SingleAsync(f => f.Id == a.Id)).DisplayName.Should().Be("A-809");

        var clash = await h.Handle(new UpdateFlatCommand(a.Id, "a", "A-808", 8), default);
        clash.Error!.Code.Should().Be("FLAT.EXISTS");
        (await h.Handle(new UpdateFlatCommand(a.Id, "A", "809", 8), default)).IsSuccess.Should().BeTrue();   // unchanged is fine
    }

    [Fact] public async Task UpdateFlat_ByNonAdmin_OrFromAnotherSociety_IsRefused()
    {
        var a = NewFlat("807", "A", 8);
        await _db.SaveChangesAsync();
        (await new UpdateFlatHandler(_db, Me(admin: false)).Handle(new UpdateFlatCommand(a.Id, "A", "1", 1), default)).IsSuccess.Should().BeFalse();
        (await new UpdateFlatHandler(_db, Me(society: Guid.NewGuid())).Handle(new UpdateFlatCommand(a.Id, "A", "1", 1), default)).IsSuccess.Should().BeFalse();
        (await _db.Flats.SingleAsync()).Number.Should().Be("807");
    }
}
