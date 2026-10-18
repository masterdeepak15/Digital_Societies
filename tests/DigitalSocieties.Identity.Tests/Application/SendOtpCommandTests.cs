using Xunit;
using FluentAssertions;
using NSubstitute;
using DigitalSocieties.Identity.Application.Commands;
using DigitalSocieties.Identity.Infrastructure.Services;
using DigitalSocieties.Shared.Contracts;

namespace DigitalSocieties.Identity.Tests.Application;

public class SendOtpCommandTests
{
    private readonly IOtpService   _otp  = Substitute.For<IOtpService>();
    private readonly IRateLimiter  _rate = Substitute.For<IRateLimiter>();
    private readonly INotificationChannel _email = Substitute.For<INotificationChannel>();

    public SendOtpCommandTests()
    {
        _email.ChannelName.Returns("email");
        _email.IsEnabled.Returns(true);
        _email.SendAsync(Arg.Any<NotificationMessage>(), Arg.Any<CancellationToken>()).Returns(true);
        _rate.CheckAsync(Arg.Any<string>(), Arg.Any<int>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>())
             .Returns(new RateLimitResult(true));
        _otp.CreateAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(new OtpCreateResult("123456", DateTimeOffset.UtcNow.AddMinutes(10)));
    }

    private SendOtpCommandHandler Handler(params INotificationChannel[] channels)
        => new(_otp, channels, _rate);

    [Fact]
    public async Task Send_NoEmailChannel_FailsEmailNotConfigured()
    {
        var sms = Substitute.For<INotificationChannel>();
        sms.ChannelName.Returns("sms");

        var result = await Handler(sms).Handle(new SendOtpCommand("a@x.io", "login"), default);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("EMAIL.NOT_CONFIGURED");
        await _otp.DidNotReceiveWithAnyArgs().CreateAsync(default!, default!, default);
    }

    [Fact]
    public async Task Send_DisabledEmailChannel_FailsEmailNotConfigured()
    {
        _email.IsEnabled.Returns(false);
        var result = await Handler(_email).Handle(new SendOtpCommand("a@x.io", "login"), default);
        result.Error!.Code.Should().Be("EMAIL.NOT_CONFIGURED");
    }

    [Fact]
    public async Task Send_ChannelReturnsFalse_FailsSendFailedAndErrorHasNoCode()
    {
        _email.SendAsync(Arg.Any<NotificationMessage>(), Arg.Any<CancellationToken>()).Returns(false);

        var result = await Handler(_email).Handle(new SendOtpCommand("a@x.io", "login"), default);

        result.Error!.Code.Should().Be("EMAIL.SEND_FAILED");
        result.Error.Message.Should().NotContain("123456");
    }

    [Fact]
    public async Task Send_RateLimited_FailsRateLimited()
    {
        _rate.CheckAsync(Arg.Any<string>(), Arg.Any<int>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>())
             .Returns(new RateLimitResult(false, 42));

        var result = await Handler(_email).Handle(new SendOtpCommand("a@x.io", "login"), default);

        result.Error!.Code.Should().Be("OTP.RATE_LIMITED");
        result.Error.Message.Should().Contain("42");
    }

    [Fact]
    public async Task Send_NormalisesEmailForRateKeyOtpAndRecipient()
    {
        await Handler(_email).Handle(new SendOtpCommand("  A@X.io ", "login"), default);

        await _rate.Received().CheckAsync("otp:a@x.io", 3, TimeSpan.FromHours(1), Arg.Any<CancellationToken>());
        await _otp.Received().CreateAsync("a@x.io", "login", Arg.Any<CancellationToken>());
        await _email.Received().SendAsync(
            Arg.Is<NotificationMessage>(m => m.Recipient == "a@x.io" && m.Body.Contains("123456")),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Send_Success_ReturnsMaskedEmailAnd600Seconds()
    {
        var result = await Handler(_email).Handle(new SendOtpCommand("ann@example.com", "login"), default);

        result.IsSuccess.Should().BeTrue();
        result.Value!.MaskedEmail.Should().Be("a***@example.com");
        result.Value.ExpiresInSeconds.Should().Be(600);
    }

    [Fact]
    public async Task Send_ResponseIsIdenticalForDifferentAddresses()
    {
        var a = await Handler(_email).Handle(new SendOtpCommand("known@example.com",   "login"), default);
        var b = await Handler(_email).Handle(new SendOtpCommand("unknown@example.com", "login"), default);

        a.Value!.ExpiresInSeconds.Should().Be(b.Value!.ExpiresInSeconds);
        a.IsSuccess.Should().Be(b.IsSuccess);
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-an-email")]
    [InlineData("a@b")]
    public void Validator_RejectsInvalidEmail(string email)
        => new SendOtpCommandValidator().Validate(new SendOtpCommand(email, "login")).IsValid.Should().BeFalse();

    [Fact]
    public void Validator_RejectsOver250CharEmail()
        => new SendOtpCommandValidator()
            .Validate(new SendOtpCommand(new string('a', 246) + "@x.io", "login")).IsValid.Should().BeFalse();

    [Fact]
    public void Validator_AcceptsValidEmailAndPurpose()
        => new SendOtpCommandValidator().Validate(new SendOtpCommand("a+b@x.io", "login")).IsValid.Should().BeTrue();
}
