using Xunit;
using FluentAssertions;
using NSubstitute;
using DigitalSocieties.Identity.Application.Commands;
using DigitalSocieties.Identity.Domain.Entities;
using DigitalSocieties.Identity.Infrastructure.Persistence;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Domain.ValueObjects;

namespace DigitalSocieties.Identity.Tests.Application;

public class ProfileCommandTests
{
    private readonly ICurrentUser    _me    = Substitute.For<ICurrentUser>();
    private readonly IUserRepository _users = Substitute.For<IUserRepository>();
    private readonly IUnitOfWork     _uow   = Substitute.For<IUnitOfWork>();
    private readonly User _user = User.Create(Email.Create("ann@example.com").Value!, "New User");

    public ProfileCommandTests()
    {
        _me.IsAuthenticated.Returns(true);
        _me.UserId.Returns(_user.Id);
        _users.FindByIdAsync(_user.Id, Arg.Any<CancellationToken>()).Returns(_user);
    }

    private SetPhoneCommandHandler PhoneHandler() => new(_me, _users, _uow);
    private SetNameCommandHandler  NameHandler()  => new(_me, _users, _uow);

    [Fact]
    public async Task SetPhone_Valid_Persists()
    {
        var result = await PhoneHandler().Handle(new SetPhoneCommand("+14155552671"), default);

        result.IsSuccess.Should().BeTrue();
        _user.Phone.Should().Be("+14155552671");
        await _uow.Received(1).CommitAsync(Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task SetPhone_NullOrBlank_Clears(string? phone)
    {
        _user.SetPhone(PhoneNumber.Create("+14155552671").Value!);

        var result = await PhoneHandler().Handle(new SetPhoneCommand(phone), default);

        result.IsSuccess.Should().BeTrue();
        _user.Phone.Should().BeNull();
    }

    [Fact]
    public async Task SetPhone_Invalid_FailsAndKeepsPhone()
    {
        var result = await PhoneHandler().Handle(new SetPhoneCommand("+1234"), default);

        result.Error!.Code.Should().Be("PHONE.INVALID");
        await _uow.DidNotReceiveWithAnyArgs().CommitAsync(default);
    }

    [Fact]
    public async Task SetPhone_Unauthenticated_FailsUnauthorized()
    {
        _me.IsAuthenticated.Returns(false);
        _me.UserId.Returns((Guid?)null);

        var result = await PhoneHandler().Handle(new SetPhoneCommand("+14155552671"), default);

        result.Error!.Code.Should().Be("UNAUTHORIZED");
    }

    [Fact]
    public async Task SetName_Valid_Renames()
    {
        var result = await NameHandler().Handle(new SetNameCommand("  Priya Shah "), default);

        result.IsSuccess.Should().BeTrue();
        _user.Name.Should().Be("Priya Shah");
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void SetName_Validator_RejectsBlank(string name)
        => new SetNameCommandValidator().Validate(new SetNameCommand(name)).IsValid.Should().BeFalse();
}
