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

    [Fact] public async Task Remove_EndsEveryRole_ButKeepsTheAccount()
    {
        var guard = (await Add(new("ramu@x.com", "Ramu", "guard"))).Value;
        await Add(new("ramu@x.com", "Ramu", "staff"));

        var r = await new RemoveSocietyMemberHandler(_db, Me()).Handle(new RemoveSocietyMemberCommand(guard), default);

        r.IsSuccess.Should().BeTrue();
        (await _db.Memberships.CountAsync(m => m.UserId == guard && m.IsActive)).Should().Be(0);
        (await _db.Users.AnyAsync(u => u.Id == guard)).Should().BeTrue();
    }

    [Fact] public async Task Remove_Yourself_IsRefused()
    {
        var r = await new RemoveSocietyMemberHandler(_db, Me()).Handle(new RemoveSocietyMemberCommand(_adminId), default);
        r.IsSuccess.Should().BeFalse();
        r.Error!.Code.Should().Be("MEMBER.SELF_REMOVE");
    }

    [Fact] public async Task Remove_TheOnlyOtherAdmin_ByAnotherAdmin_Works_ButNotTheLastOne()
    {
        // second admin removes nobody here; the first removing the second is fine, and the second cannot be the last
        var second = (await Add(new("boss@x.com", "Boss", "admin"))).Value;
        var ok = await new RemoveSocietyMemberHandler(_db, Me()).Handle(new RemoveSocietyMemberCommand(second), default);
        ok.IsSuccess.Should().BeTrue();

        // now only _adminId remains; a different caller trying to remove them must be stopped
        var other = Substitute.For<ICurrentUser>();
        other.SocietyId.Returns(SocietyId); other.UserId.Returns(Guid.NewGuid()); other.IsInRole("admin").Returns(true);
        var blocked = await new RemoveSocietyMemberHandler(_db, other).Handle(new RemoveSocietyMemberCommand(_adminId), default);
        blocked.IsSuccess.Should().BeFalse();
        blocked.Error!.Code.Should().Be("MEMBER.LAST_ADMIN");
    }

    [Fact] public async Task Remove_ByNonAdmin_IsRefused()
    {
        var guard = (await Add(new("ramu@x.com", "Ramu", "guard"))).Value;
        var r = await new RemoveSocietyMemberHandler(_db, Me(admin: false)).Handle(new RemoveSocietyMemberCommand(guard), default);
        r.IsSuccess.Should().BeFalse();
        (await _db.Memberships.CountAsync(m => m.UserId == guard && m.IsActive)).Should().Be(1);
    }
}
