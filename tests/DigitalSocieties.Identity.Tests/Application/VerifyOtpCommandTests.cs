using Xunit;
using FluentAssertions;
using NSubstitute;
using DigitalSocieties.Identity.Application.Commands;
using DigitalSocieties.Identity.Domain.Entities;
using DigitalSocieties.Identity.Infrastructure.Persistence;
using DigitalSocieties.Identity.Infrastructure.Security;
using DigitalSocieties.Identity.Infrastructure.Services;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Domain.ValueObjects;
using DigitalSocieties.Shared.Results;

namespace DigitalSocieties.Identity.Tests.Application;

public class VerifyOtpCommandTests
{
    private readonly IOtpService     _otp   = Substitute.For<IOtpService>();
    private readonly IUserRepository _users = Substitute.For<IUserRepository>();
    private readonly IJwtService     _jwt   = Substitute.For<IJwtService>();
    private readonly IUnitOfWork     _uow   = Substitute.For<IUnitOfWork>();

    public VerifyOtpCommandTests()
    {
        _otp.VerifyAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(Result.Ok());
        _jwt.IssueTokensAsync(Arg.Any<User>(), Arg.Any<IReadOnlyList<MembershipInfo>>(), Arg.Any<CancellationToken>())
            .Returns(("access", "refresh", 600));
    }

    private VerifyOtpCommandHandler Handler() => new(_otp, _users, _jwt, _uow);

    private static VerifyOtpCommand Cmd(string email = "ann@example.com")
        => new(email, "123456", "login", null, null, null);

    [Fact]
    public async Task Verify_NewEmail_CreatesUserNamedNewUser_IsNewUserTrue()
    {
        _users.FindByEmailAsync("ann@example.com", Arg.Any<CancellationToken>()).Returns((User?)null);

        var result = await Handler().Handle(Cmd("  Ann@Example.com "), default);

        result.IsSuccess.Should().BeTrue();
        result.Value!.IsNewUser.Should().BeTrue();
        result.Value.Profile.Email.Should().Be("ann@example.com");
        result.Value.Profile.Phone.Should().BeNull();
        result.Value.Profile.Name.Should().Be("New User");
        _users.Received(1).Add(Arg.Is<User>(u => u.Email == "ann@example.com"));
        await _otp.Received().VerifyAsync("ann@example.com", "123456", "login", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Verify_ExistingEmail_ReturnsTokens()
    {
        var user = User.Create(Email.Create("ann@example.com").Value!, "Ann");
        _users.FindByEmailAsync("ann@example.com", Arg.Any<CancellationToken>()).Returns(user);

        var result = await Handler().Handle(Cmd(), default);

        result.Value!.AccessToken.Should().Be("access");
        result.Value.RefreshToken.Should().Be("refresh");
        result.Value.IsNewUser.Should().BeFalse();
        _users.Received(1).Update(user);
    }

    [Fact]
    public async Task Verify_WrongOtp_FailsAndDoesNotCreateUser()
    {
        _otp.VerifyAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(Result.Fail("OTP.INVALID", "Incorrect code."));

        var result = await Handler().Handle(Cmd(), default);

        result.IsFailure.Should().BeTrue();
        _users.DidNotReceiveWithAnyArgs().Add(default!);
    }

    [Fact]
    public async Task Verify_TwoFactorEnabled_ReturnsPendingNoTokens()
    {
        var user = User.Create(Email.Create("ann@example.com").Value!, "Ann");
        user.SetPending2FaSecret("JBSWY3DPEHPK3PXP");
        user.Activate2Fa();
        _users.FindByEmailAsync("ann@example.com", Arg.Any<CancellationToken>()).Returns(user);

        var result = await Handler().Handle(Cmd(), default);

        result.Value!.RequiresTwoFactor.Should().BeTrue();
        result.Value.PendingUserId.Should().Be(user.Id);
        result.Value.AccessToken.Should().BeEmpty();
        await _jwt.DidNotReceiveWithAnyArgs().IssueTokensAsync(default!, default!, default);
    }

    [Fact]
    public async Task Verify_InvalidEmail_FailsBeforeOtpCheck()
    {
        var result = await Handler().Handle(Cmd("nope"), default);

        result.Error!.Code.Should().Be("EMAIL.INVALID");
        await _otp.DidNotReceiveWithAnyArgs().VerifyAsync(default!, default!, default!, default);
    }
}
