using Xunit;
using FluentAssertions;
using NSubstitute;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Identity.Application.Commands;
using DigitalSocieties.Identity.Domain.Entities;
using DigitalSocieties.Identity.Infrastructure.Persistence;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Domain.ValueObjects;

namespace DigitalSocieties.Identity.Tests.Application;

public class ManageSocietyMembersTests
{
    private static readonly Guid SocietyId = Guid.NewGuid();
    private readonly Guid _adminId;
    private readonly IdentityDbContext _db;
    private readonly Flat _flat = Flat.Create(SocietyId, "A-807", "A", 8);

    public ManageSocietyMembersTests()
    {
        _db = new IdentityDbContext(
            new DbContextOptionsBuilder<IdentityDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options,
            Substitute.For<ICurrentUser>());
        _db.Flats.Add(_flat);
        var admin = User.Create(Email.Create("admin@x.com").Value!, "Admin");
        _adminId = admin.Id;
        _db.Users.Add(admin);
        _db.Memberships.Add(Membership.Create(_adminId, SocietyId, "admin", null, "staff"));
        _db.SaveChanges();
    }

    private ICurrentUser Me(bool admin = true)
    {
        var cu = Substitute.For<ICurrentUser>();
        cu.SocietyId.Returns(SocietyId);
        cu.UserId.Returns(_adminId);
        cu.IsInRole("admin").Returns(admin);
        return cu;
    }

    private Task<DigitalSocieties.Shared.Results.Result<Guid>> Add(AddSocietyMemberCommand c, bool admin = true)
        => new AddSocietyMemberHandler(_db, Me(admin)).Handle(c, default);

    [Fact] public async Task Admin_AddsAGuard_WithoutAFlat()
    {
        var r = await Add(new("ramu@x.com", "Ramu", "guard", "9975001174"));
        r.IsSuccess.Should().BeTrue();
        var m = await _db.Memberships.SingleAsync(x => x.UserId == r.Value);
        (m.Role, m.FlatId, m.MemberType, m.IsActive).Should().Be(("guard", null, "staff", true));
    }

    [Fact] public async Task Admin_AddsStaff_AndAnotherAdmin()
    {
        (await Add(new("sita@x.com", "Sita", "staff"))).IsSuccess.Should().BeTrue();
        (await Add(new("boss@x.com", "Boss", "admin"))).IsSuccess.Should().BeTrue();
        (await _db.Memberships.CountAsync(m => m.Role == "staff" || m.Role == "admin")).Should().Be(3);
    }

    [Fact] public async Task Admin_AddsAResident_ToAFlat_ById()
    {
        var r = await Add(new("deepak@x.com", "Deepak", "resident", MemberType: "owner", FlatId: _flat.Id));
        r.IsSuccess.Should().BeTrue();
        (await _db.Memberships.SingleAsync(m => m.UserId == r.Value)).FlatId.Should().Be(_flat.Id);
    }

    [Fact] public async Task Admin_AddsAResident_ToAFlat_ByNumber()
    {
        var r = await Add(new("a@x.com", "A", "resident", MemberType: "tenant", Wing: "A", FlatNumber: "A-807"));
        r.IsSuccess.Should().BeTrue();
    }

    [Fact] public async Task UnknownFlat_IsRefused()
    {
        var r = await Add(new("a@x.com", "A", "resident", MemberType: "owner", FlatId: Guid.NewGuid()));
        r.IsSuccess.Should().BeFalse();
        r.Error!.Code.Should().Be("FLAT.NOT_FOUND");
        (await _db.Users.CountAsync()).Should().Be(1);   // no stray account was created
    }

    [Fact] public async Task ExistingPerson_GetsAnotherRole_NotASecondAccount()
    {
        await Add(new("admin@x.com", "Admin", "resident", MemberType: "owner", FlatId: _flat.Id));
        (await _db.Users.CountAsync()).Should().Be(1);
        (await _db.Memberships.CountAsync(m => m.UserId == _adminId && m.IsActive)).Should().Be(2);
    }

    [Fact] public async Task SamePersonSameRole_IsRefused()
    {
        await Add(new("ramu@x.com", "Ramu", "guard"));
        var again = await Add(new("ramu@x.com", "Ramu", "guard"));
        again.IsSuccess.Should().BeFalse();
        again.Error!.Code.Should().Be("MEMBER.EXISTS");
    }

    [Fact] public async Task APhoneAlreadyInUse_IsRefused()
    {
        await Add(new("one@x.com", "One", "guard", "9975001174"));
        var r = await Add(new("two@x.com", "Two", "staff", "9975001174"));
        r.IsSuccess.Should().BeFalse();
        r.Error!.Code.Should().Be("PHONE.TAKEN");
    }

    [Fact] public async Task NonAdmin_CannotAddAnyone()
    {
        var r = await Add(new("x@x.com", "X", "guard"), admin: false);
        r.IsSuccess.Should().BeFalse();
        (await _db.Users.CountAsync()).Should().Be(1);
    }

    [Theory]
    [InlineData("guard", null, null)]                 // fine
    [InlineData("resident", null, null)]              // resident needs a flat and a type
    [InlineData("resident", "owner", null)]           // flat missing
    [InlineData("janitor", null, null)]               // unknown role
    public void Validator_ChecksRoleAndFlat(string role, string? type, string? flat)
    {
        var ok = new AddSocietyMemberValidator().Validate(new AddSocietyMemberCommand("a@x.com", "A", role, null, type, null, flat)).IsValid;
        ok.Should().Be(role == "guard");
    }

    private Task<Guid> MembershipOf(Guid userId, string role)
        => _db.Memberships.Where(m => m.UserId == userId && m.Role == role).Select(m => m.Id).SingleAsync();

    private Task<DigitalSocieties.Shared.Results.Result> Remove(Guid membershipId, bool admin = true)
        => new RemoveSocietyMembershipHandler(_db, Me(admin)).Handle(new RemoveSocietyMembershipCommand(membershipId), default);

    private Task<DigitalSocieties.Shared.Results.Result> Edit(EditSocietyMemberCommand c, bool admin = true)
        => new EditSocietyMemberHandler(_db, Me(admin)).Handle(c, default);

    // ── remove ──────────────────────────────────────────────────────────────────
    [Fact] public async Task Remove_EndsOnlyThatRole_ThePersonAndTheirOtherRolesStay()
    {
        var person = (await Add(new("ramu@x.com", "Ramu", "guard"))).Value;
        await Add(new("ramu@x.com", "Ramu", "staff"));

        (await Remove(await MembershipOf(person, "guard"))).IsSuccess.Should().BeTrue();

        (await _db.Memberships.Where(m => m.UserId == person && m.IsActive).Select(m => m.Role).ToListAsync()).Should().Equal("staff");
        (await _db.Users.AnyAsync(u => u.Id == person)).Should().BeTrue();
    }

    [Fact] public async Task AnAdmin_CanNeverBeRemoved_NotEvenByAnotherAdmin()
    {
        var second = (await Add(new("boss@x.com", "Boss", "admin"))).Value;

        var r = await Remove(await MembershipOf(second, "admin"));
        r.IsSuccess.Should().BeFalse();
        r.Error!.Code.Should().Be("MEMBER.ADMIN_PROTECTED");

        var self = await Remove(await MembershipOf(_adminId, "admin"));
        self.Error!.Code.Should().Be("MEMBER.ADMIN_PROTECTED");
        (await _db.Memberships.CountAsync(m => m.Role == "admin" && m.IsActive)).Should().Be(2);
    }

    [Fact] public async Task Remove_ByNonAdmin_IsRefused()
    {
        var guard = (await Add(new("ramu@x.com", "Ramu", "guard"))).Value;
        var r = await Remove(await MembershipOf(guard, "guard"), admin: false);
        r.IsSuccess.Should().BeFalse();
        (await _db.Memberships.CountAsync(m => m.UserId == guard && m.IsActive)).Should().Be(1);
    }

    [Fact] public async Task Remove_OfAnotherSocietysMember_IsRefused()
    {
        var guard = (await Add(new("ramu@x.com", "Ramu", "guard"))).Value;
        var id = await MembershipOf(guard, "guard");
        var other = Substitute.For<ICurrentUser>();
        other.SocietyId.Returns(Guid.NewGuid()); other.IsInRole("admin").Returns(true);
        (await new RemoveSocietyMembershipHandler(_db, other).Handle(new RemoveSocietyMembershipCommand(id), default)).IsSuccess.Should().BeFalse();
    }

    // ── edit ────────────────────────────────────────────────────────────────────
    [Fact] public async Task Edit_ChangesNameAndPhone_OfThePerson()
    {
        var guard = (await Add(new("ramu@x.com", "Ramu", "guard", "9975001174"))).Value;
        var r = await Edit(new(await MembershipOf(guard, "guard"), "Ramu Singh", "9975001199"));
        r.IsSuccess.Should().BeTrue();
        var u = await _db.Users.SingleAsync(x => x.Id == guard);
        (u.Name, u.Phone).Should().Be(("Ramu Singh", "+919975001199"));
    }

    [Fact] public async Task Edit_CanClearThePhone()
    {
        var guard = (await Add(new("ramu@x.com", "Ramu", "guard", "9975001174"))).Value;
        (await Edit(new(await MembershipOf(guard, "guard"), "Ramu", null))).IsSuccess.Should().BeTrue();
        (await _db.Users.SingleAsync(x => x.Id == guard)).Phone.Should().BeNull();
    }

    [Fact] public async Task Edit_RefusesAPhoneAnotherPersonUses()
    {
        await Add(new("one@x.com", "One", "guard", "9975001174"));
        var two = (await Add(new("two@x.com", "Two", "staff", "9975001175"))).Value;
        var r = await Edit(new(await MembershipOf(two, "staff"), "Two", "9975001174"));
        r.Error!.Code.Should().Be("PHONE.TAKEN");
    }

    [Fact] public async Task Edit_MovesAResident_ToAnotherFlat_AndChangesRelationship()
    {
        var other = Flat.Create(SocietyId, "808", "A", 8);
        _db.Flats.Add(other); await _db.SaveChangesAsync();
        var r = (await Add(new("d@x.com", "D", "resident", MemberType: "tenant", FlatId: _flat.Id))).Value;

        (await Edit(new(await MembershipOf(r, "resident"), "D", null, MemberType: "owner", FlatId: other.Id))).IsSuccess.Should().BeTrue();

        var m = await _db.Memberships.SingleAsync(x => x.UserId == r);
        (m.FlatId, m.MemberType).Should().Be((other.Id, "owner"));
    }

    [Fact] public async Task Edit_GuardToResident_NeedsAFlat_AndResidentToGuard_DropsTheFlat()
    {
        var p = (await Add(new("ramu@x.com", "Ramu", "guard"))).Value;
        var noFlat = await Edit(new(await MembershipOf(p, "guard"), "Ramu", null, Role: "resident", MemberType: "owner"));
        noFlat.Error!.Code.Should().Be("FLAT.REQUIRED");

        (await Edit(new(await MembershipOf(p, "guard"), "Ramu", null, Role: "resident", MemberType: "owner", FlatId: _flat.Id))).IsSuccess.Should().BeTrue();
        (await Edit(new(await MembershipOf(p, "resident"), "Ramu", null, Role: "guard"))).IsSuccess.Should().BeTrue();
        var m = await _db.Memberships.SingleAsync(x => x.UserId == p && x.IsActive);
        (m.Role, m.FlatId, m.MemberType).Should().Be(("guard", null, "staff"));
    }

    [Fact] public async Task Edit_CanPromoteToAdmin_ButNeverDemoteAnAdmin()
    {
        var p = (await Add(new("ramu@x.com", "Ramu", "guard"))).Value;
        (await Edit(new(await MembershipOf(p, "guard"), "Ramu", null, Role: "admin"))).IsSuccess.Should().BeTrue();

        var demote = await Edit(new(await MembershipOf(p, "admin"), "Ramu", null, Role: "guard"));
        demote.Error!.Code.Should().Be("MEMBER.ADMIN_PROTECTED");
        (await _db.Memberships.AnyAsync(m => m.UserId == p && m.Role == "admin" && m.IsActive)).Should().BeTrue();
    }

    [Fact] public async Task Edit_OfAnAdmin_StillAllowsNameAndPhone()
    {
        var r = await Edit(new(await MembershipOf(_adminId, "admin"), "Deepak S. Chougale", "9975001173"));
        r.IsSuccess.Should().BeTrue();
        (await _db.Users.SingleAsync(u => u.Id == _adminId)).Name.Should().Be("Deepak S. Chougale");
    }

    [Fact] public async Task Edit_ToARoleThePersonAlreadyHas_IsRefused()
    {
        var p = (await Add(new("ramu@x.com", "Ramu", "guard"))).Value;
        await Add(new("ramu@x.com", "Ramu", "staff"));
        var r = await Edit(new(await MembershipOf(p, "guard"), "Ramu", null, Role: "staff"));
        r.Error!.Code.Should().Be("MEMBER.EXISTS");
    }

    [Fact] public async Task Edit_ByNonAdmin_IsRefused()
    {
        var p = (await Add(new("ramu@x.com", "Ramu", "guard"))).Value;
        (await Edit(new(await MembershipOf(p, "guard"), "Hacked", null), admin: false)).IsSuccess.Should().BeFalse();
        (await _db.Users.SingleAsync(u => u.Id == p)).Name.Should().Be("Ramu");
    }
}
