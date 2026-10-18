using Xunit;
using FluentAssertions;
using NSubstitute;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using DigitalSocieties.Communication.Infrastructure.Channels;
using DigitalSocieties.Communication.Infrastructure.Push;
using DigitalSocieties.Shared.Contracts;

namespace DigitalSocieties.Identity.Tests.Communication;

public class ChannelConfigTests
{
    [Theory]
    [InlineData(null,               "from@x.io", false)]
    [InlineData("",                 "from@x.io", false)]
    [InlineData("${SMTP_HOST}",     "from@x.io", false)]
    [InlineData("smtp.x.io",        "",          false)]
    [InlineData("smtp.x.io",        "${FROM}",   false)]
    [InlineData("smtp.x.io",        "from@x.io", true)]
    public void EmailSettings_IsConfigured(string? host, string from, bool expected)
        => new EmailSettings { Host = host, FromAddress = from }.IsConfigured.Should().Be(expected);

    [Theory]
    [InlineData(null,                 false)]
    [InlineData("",                   false)]
    [InlineData("   ",                false)]
    [InlineData("${MSG91_API_KEY}",   false)]
    [InlineData("real-key",           true)]
    public void Msg91Settings_IsConfigured(string? apiKey, bool expected)
        => new Msg91Settings { ApiKey = apiKey! }.IsConfigured.Should().Be(expected);

    private static SmtpEmailChannel Channel(EmailSettings s, string env)
    {
        var host = Substitute.For<IHostEnvironment>();
        host.EnvironmentName.Returns(env);
        return new SmtpEmailChannel(Options.Create(s), host, NullLogger<SmtpEmailChannel>.Instance);
    }

    private static readonly NotificationMessage Msg = new("a@x.io", "Subject", "Your code is 123456");

    [Fact]
    public async Task EmailChannel_UnconfiguredInDevelopment_IsEnabledAndSucceeds()
    {
        var ch = Channel(new EmailSettings(), Environments.Development);
        ch.ChannelName.Should().Be("email");
        ch.IsEnabled.Should().BeTrue();
        (await ch.SendAsync(Msg)).Should().BeTrue();
    }

    [Fact]
    public async Task EmailChannel_UnconfiguredInProduction_IsDisabledAndFails()
    {
        var ch = Channel(new EmailSettings(), Environments.Production);
        ch.IsEnabled.Should().BeFalse();
        (await ch.SendAsync(Msg)).Should().BeFalse();
    }

    [Fact]
    public void EmailChannel_ConfiguredInProduction_IsEnabled()
        => Channel(new EmailSettings { Host = "smtp.x.io", FromAddress = "from@x.io" }, Environments.Production)
            .IsEnabled.Should().BeTrue();

    // ── FallbackNotificationDispatcher ───────────────────────────────────────
    private static ExpoPushChannel Push()
        => new(Substitute.For<IHttpClientFactory>(), Substitute.For<IPushTokenStore>(),
               NullLogger<ExpoPushChannel>.Instance);

    // A non-Guid recipient makes ExpoPushChannel return false without any network call.
    private static readonly NotificationMessage Alert = new("not-a-guid", "Visitor", "Visitor at gate");

    private static INotificationChannel Sms(bool ok = true)
    {
        var sms = Substitute.For<INotificationChannel>();
        sms.ChannelName.Returns("sms");
        sms.IsEnabled.Returns(true);
        sms.SendAsync(Arg.Any<NotificationMessage>(), Arg.Any<CancellationToken>()).Returns(ok);
        return sms;
    }

    private static FallbackNotificationDispatcher Dispatcher(params INotificationChannel[] channels)
        => new(Push(), channels, NullLogger<FallbackNotificationDispatcher>.Instance);

    [Fact]
    public async Task Dispatcher_SkipsSms_WhenNoSmsChannel()
        => (await Dispatcher().DispatchAsync(Alert, "+919800000001")).Should().BeNull();

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    public async Task Dispatcher_SkipsSms_WhenUserHasNoPhone(string? phone)
    {
        var sms = Sms();

        var result = await Dispatcher(sms).DispatchAsync(Alert, phone);

        result.Should().BeNull();
        await sms.DidNotReceiveWithAnyArgs().SendAsync(default!, default);
    }

    [Fact]
    public async Task Dispatcher_UsesSms_WhenConfiguredAndPhonePresent()
    {
        var sms = Sms();

        var result = await Dispatcher(sms).DispatchAsync(Alert, "+919800000001");

        result.Should().Be("sms");
        await sms.Received(1).SendAsync(Arg.Is<NotificationMessage>(m => m.Recipient == "+919800000001"), Arg.Any<CancellationToken>());
    }
}
