using Xunit;
using FluentAssertions;
using NSubstitute;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Identity.Application.Commands;
using DigitalSocieties.Identity.Application.Queries;
using DigitalSocieties.Identity.Domain.Entities;
using DigitalSocieties.Identity.Infrastructure.Persistence;
using DigitalSocieties.Identity.Infrastructure.Security;
using DigitalSocieties.Identity.Infrastructure.Services;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Domain.ValueObjects;
using DigitalSocieties.Shared.Results;

namespace DigitalSocieties.Identity.Tests.Application;

public class AddFamilyMemberCommandTests
{
    private static readonly Guid SocietyId = Guid.NewGuid();
    private static readonly Guid FlatId    = Guid.NewGuid();

    private readonly IdentityDbContext _db;
    private readonly ICurrentUser      _me = Substitute.For<ICurrentUser>();

    public AddFamilyMemberCommandTests()
    {
        var options = new DbContextOptionsBuilder<IdentityDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        _db = new IdentityDbContext(options, Substitute.For<ICurrentUser>());
        _me.SocietyId.Returns(SocietyId);
        _me.FlatId.Returns(FlatId);
        _me.UserId.Returns(Guid.NewGuid());
    }

    private AddFamilyMemberHandler Handler() => new(_db, _me);

    [Fact]
    public async Task AddFamilyMember_NewEmail_CreatesUserAndMembership()
    {
        var result = await Handler().Handle(new AddFamilyMemberCommand("  Kid@Example.com ", "Kid", "family"), default);

        result.IsSuccess.Should().BeTrue();
        var user = await _db.Users.SingleAsync();
        user.Email.Should().Be("kid@example.com");
        user.Phone.Should().BeNull();
        (await _db.Memberships.CountAsync(m => m.UserId == user.Id && m.FlatId == FlatId)).Should().Be(1);
    }

    [Fact]
    public async Task AddFamilyMember_ExistingEmail_ReusesUser()
    {
        _db.Users.Add(User.Create(Email.Create("kid@example.com").Value!, "Kid"));
        await _db.SaveChangesAsync();

        var result = await Handler().Handle(new AddFamilyMemberCommand("KID@example.com", "Kid", "family"), default);

        result.IsSuccess.Should().BeTrue();
        (await _db.Users.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task AddFamilyMember_OptionalPhone_IsStored()
    {
        await Handler().Handle(new AddFamilyMemberCommand("kid@example.com", "Kid", "family", "+14155552671"), default);

        (await _db.Users.SingleAsync()).Phone.Should().Be("+14155552671");
    }

    [Fact]
    public async Task AddFamilyMember_PhoneAlreadyUsedByAnotherUser_FailsPhoneTaken()
    {
        var other = User.Create(Email.Create("other@example.com").Value!, "Other", PhoneNumber.Create("+14155552671").Value!);
        _db.Users.Add(other);
        await _db.SaveChangesAsync();

        var result = await Handler().Handle(new AddFamilyMemberCommand("kid@example.com", "Kid", "family", "+14155552671"), default);

        result.Error!.Code.Should().Be("PHONE.TAKEN");
        (await _db.Users.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task AddFamilyMember_InvalidEmail_Fails()
    {
        var result = await Handler().Handle(new AddFamilyMemberCommand("nope", "Kid", "family"), default);

        result.Error!.Code.Should().Be("EMAIL.INVALID");
        (await _db.Users.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task AddFamilyMember_SameMemberTwice_FailsExists()
    {
        await Handler().Handle(new AddFamilyMemberCommand("kid@example.com", "Kid", "family"), default);

        var second = await Handler().Handle(new AddFamilyMemberCommand("kid@example.com", "Kid", "family"), default);

        second.Error!.Code.Should().Be("MEMBER.EXISTS");
    }

    // ── Admin adds a member to a named flat (an admin has no flat of their own) ──
    private async Task<Flat> SeedFlatAsync(string wing, string number)
    {
        var flat = Flat.Create(SocietyId, number, wing, 1);
        _db.Flats.Add(flat);
        await _db.SaveChangesAsync();
        return flat;
    }

    [Fact]
    public async Task AddFamilyMember_AdminWithFlatNumber_AddsToThatFlat()
    {
        var flat = await SeedFlatAsync("B", "204");
        _me.FlatId.Returns((Guid?)null);
        _me.IsInRole("admin").Returns(true);

        var result = await Handler().Handle(new AddFamilyMemberCommand("kid@example.com", "Kid", "family", null, "B", "204"), default);

        result.IsSuccess.Should().BeTrue();
        (await _db.Memberships.CountAsync(m => m.FlatId == flat.Id)).Should().Be(1);
    }

    [Fact]
    public async Task AddFamilyMember_AdminUnknownFlat_FailsFlatNotFound()
    {
        _me.FlatId.Returns((Guid?)null);
        _me.IsInRole("admin").Returns(true);

        var result = await Handler().Handle(new AddFamilyMemberCommand("kid@example.com", "Kid", "family", null, "Z", "999"), default);

        result.Error!.Code.Should().Be("FLAT.NOT_FOUND");
    }

    [Fact]
    public async Task AddFamilyMember_ResidentCannotChooseAnotherFlat()
    {
        var other = await SeedFlatAsync("C", "301");
        _me.IsInRole("admin").Returns(false);

        await Handler().Handle(new AddFamilyMemberCommand("kid@example.com", "Kid", "family", null, "C", "301"), default);

        (await _db.Memberships.CountAsync(m => m.FlatId == other.Id)).Should().Be(0);
        (await _db.Memberships.CountAsync(m => m.FlatId == FlatId)).Should().Be(1);
    }

    [Fact]
    public async Task AddFamilyMember_NonAdminWithoutFlat_FailsFlatRequired()
    {
        _me.FlatId.Returns((Guid?)null);

        var result = await Handler().Handle(new AddFamilyMemberCommand("kid@example.com", "Kid", "family"), default);

        result.Error!.Code.Should().Be("FLAT.REQUIRED");
    }

    [Fact]
    public async Task RemoveFamilyMember_AdminRemovesMemberOfAnyFlat()
    {
        var flat = await SeedFlatAsync("B", "204");
        var user = User.Create(Email.Create("kid@example.com").Value!, "Kid");
        _db.Users.Add(user);
        _db.Memberships.Add(Membership.Create(user.Id, SocietyId, "resident", flat.Id, "family"));
        await _db.SaveChangesAsync();
        _me.FlatId.Returns((Guid?)null);
        _me.IsInRole("admin").Returns(true);

        var result = await new RemoveFamilyMemberHandler(_db, _me).Handle(new RemoveFamilyMemberCommand(user.Id), default);

        result.IsSuccess.Should().BeTrue();
        (await _db.Memberships.AnyAsync(m => m.UserId == user.Id && m.IsActive)).Should().BeFalse();
    }

    [Fact]
    public async Task RemoveFamilyMember_ResidentCannotRemoveMemberOfAnotherFlat()
    {
        var flat = await SeedFlatAsync("B", "204");
        var user = User.Create(Email.Create("kid@example.com").Value!, "Kid");
        _db.Users.Add(user);
        _db.Memberships.Add(Membership.Create(user.Id, SocietyId, "resident", flat.Id, "family"));
        await _db.SaveChangesAsync();

        var result = await new RemoveFamilyMemberHandler(_db, _me).Handle(new RemoveFamilyMemberCommand(user.Id), default);

        result.Error!.Code.Should().Be("MEMBER.NOT_FOUND");
    }

    [Fact]
    public async Task GetFlatMembers_UserWithoutPhone_DoesNotThrow()
    {
        await Handler().Handle(new AddFamilyMemberCommand("kid@example.com", "Kid", "family"), default);

        var result = await new GetFlatMembersHandler(_db, _me).Handle(new GetFlatMembersQuery(), default);

        result.IsSuccess.Should().BeTrue();
        var member = result.Value!.Single();
        member.Email.Should().Be("kid@example.com");
        member.Phone.Should().BeNull();
    }

    [Fact]
    public async Task GetSocietyMembers_UserWithoutPhone_DoesNotThrow()
    {
        await Handler().Handle(new AddFamilyMemberCommand("kid@example.com", "Kid", "family"), default);

        var result = await new GetSocietyMembersHandler(_db, _me).Handle(new GetSocietyMembersQuery(), default);

        result.Value!.Single().Phone.Should().BeNull();
    }

    [Fact]
    public async Task InitializeSociety_NewAdminEmail_CreatesAdminAndVerifiesRegisterCode()
    {
        var otp = Substitute.For<IOtpService>();
        otp.VerifyAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
           .Returns(Result.Ok());
        var jwt = Substitute.For<IJwtService>();
        jwt.IssueTokensAsync(Arg.Any<User>(), Arg.Any<IReadOnlyList<MembershipInfo>>(), Arg.Any<CancellationToken>())
           .Returns(("access", "refresh", 600));
        var handler = new InitializeSocietyCommandHandler(_db, otp, jwt);

        var result = await handler.Handle(new InitializeSocietyCommand(
            new SocietyInput("Sunrise Heights", "Plot 42, Baner Road, Pune", "REG-1", 10),
            new AdminInput("Admin@Example.com", "Rajesh", "123456"),
            null, null, null, null), default);

        result.IsSuccess.Should().BeTrue();
        result.Value!.User.Email.Should().Be("admin@example.com");
        result.Value.User.Phone.Should().BeNull();
        (await _db.Users.IgnoreQueryFilters().SingleAsync()).Email.Should().Be("admin@example.com");
        await otp.Received().VerifyAsync("admin@example.com", "123456", "register", Arg.Any<CancellationToken>());
    }
}
