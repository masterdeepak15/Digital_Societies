using Xunit;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Visitor.Infrastructure.Hubs;
using DigitalSocieties.Communication.Application.Commands;
using DigitalSocieties.Communication.Application.Notices;
using DigitalSocieties.Communication.Infrastructure.Channels;
using DigitalSocieties.Communication.Infrastructure.Persistence;
using DigitalSocieties.Communication.Infrastructure.Push;

namespace DigitalSocieties.Identity.Tests.Communication;

/// <summary>The society decides how it is told: push, SMS, email. Each switch in Settings > Notifications does what it says.</summary>
public class NotificationSettingsTests
{
    private static readonly Guid Society = Guid.NewGuid();

    private static ISocietySettingsReader Rules(SocietySettings s)
    {
        var r = Substitute.For<ISocietySettingsReader>();
        r.GetAsync(Society, Arg.Any<CancellationToken>()).Returns(s);
        return r;
    }

    // ── Posting a notice ──────────────────────────────────────────────────────

    private sealed class Notice
    {
        public ISocietyHubNotifier Hub = Substitute.For<ISocietyHubNotifier>();
        public INotificationDispatcher Dispatcher = Substitute.For<INotificationDispatcher>();
        public INoticeEmailQueue Email = Substitute.For<INoticeEmailQueue>();
        public INotificationChannel Sms = Substitute.For<INotificationChannel>();
        public CommunicationDbContext Db;
        public PostNoticeCommandHandler Handler;

        public Notice(SocietySettings rules)
        {
            var cu = Substitute.For<ICurrentUser>();
            cu.UserId.Returns(Guid.NewGuid());
            cu.SocietyId.Returns(Society);
            Db = new CommunicationDbContext(new DbContextOptionsBuilder<CommunicationDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options, cu);
            Sms.ChannelName.Returns("sms");
            Sms.IsEnabled.Returns(true);
            Handler = new PostNoticeCommandHandler(Db, cu, Hub, new[] { Sms }, Rules(rules), Dispatcher, Email);
        }

        public Task<DigitalSocieties.Shared.Results.Result<PostNoticeResponse>> Post(string type, string title = "Water cut")
            => Handler.Handle(new PostNoticeCommand(Society, title, "Water will be off from 10 to 2.", type, null), default);
    }

    [Fact] public async Task ANotice_IsPushedToTheWholeSociety_OnTheGeneralChannel()
    {
        var n = new Notice(new SocietySettings { PushEnabled = true });
        await n.Post("Notice");

        await n.Dispatcher.Received(1).DispatchAsync(
            Arg.Is<NotificationMessage>(m => m.Recipient == Society.ToString() && m.Subject == "Water cut" && m.Data!["recipientKind"] == "society" && m.Data["channelId"] == "general" && m.SocietyId == Society),
            Arg.Any<string?>(), Arg.Any<CancellationToken>());
        await n.Hub.DidNotReceive().NotifySocietyAsync(Society, "EmergencyAlert", Arg.Any<object>(), Arg.Any<CancellationToken>());
    }

    [Fact] public async Task AnEmergency_RingsTheOpenApps_AndUsesTheLoudChannel()
    {
        var n = new Notice(new SocietySettings { PushEnabled = true });
        await n.Post("Emergency", "Fire in B wing");

        await n.Hub.Received(1).NotifySocietyAsync(Society, "EmergencyAlert", Arg.Any<object>(), Arg.Any<CancellationToken>());
        await n.Dispatcher.Received(1).DispatchAsync(
            Arg.Is<NotificationMessage>(m => m.Data!["channelId"] == "emergency" && m.Subject.Contains("Fire in B wing")),
            Arg.Any<string?>(), Arg.Any<CancellationToken>());
    }

    [Fact] public async Task WithPushOff_NoPushGoesOut_ButTheNoticeIsStillPosted()
    {
        var n = new Notice(new SocietySettings { PushEnabled = false });
        var r = await n.Post("Notice");

        r.IsSuccess.Should().BeTrue();
        (await n.Db.Notices.CountAsync()).Should().Be(1);
        await n.Dispatcher.DidNotReceiveWithAnyArgs().DispatchAsync(default!, default, default);
    }

    [Fact] public async Task AFailingPush_NeverFailsThePost()
    {
        var n = new Notice(new SocietySettings { PushEnabled = true });
        n.Dispatcher.DispatchAsync(Arg.Any<NotificationMessage>(), Arg.Any<string?>(), Arg.Any<CancellationToken>()).ThrowsAsync(new InvalidOperationException("down"));

        (await n.Post("Notice")).IsSuccess.Should().BeTrue();
    }

    [Fact] public async Task EmailIsSent_OnlyWhenTheSocietyTurnedItOn()
    {
        var off = new Notice(new SocietySettings { EmailEnabled = false });
        await off.Post("Notice");
        off.Email.DidNotReceiveWithAnyArgs().Enqueue(default!);

        var on = new Notice(new SocietySettings { EmailEnabled = true });
        await on.Post("Circular", "Annual meeting");
        on.Email.Received(1).Enqueue(Arg.Is<NoticeEmail>(e => e.SocietyId == Society && e.Title == "Annual meeting" && e.Type == "Circular"));
    }

    [Fact] public async Task AnEmergencySms_GoesOnlyWhenSmsIsOn()
    {
        var off = new Notice(new SocietySettings { SmsEnabled = false });
        await off.Post("Emergency");
        await Task.Delay(30);
        await off.Sms.DidNotReceiveWithAnyArgs().SendAsync(default!, default);

        var on = new Notice(new SocietySettings { SmsEnabled = true });
        await on.Post("Emergency");
        await on.Sms.Received(1).SendAsync(Arg.Any<NotificationMessage>(), Arg.Any<CancellationToken>());
    }

    // ── Emailing a notice ─────────────────────────────────────────────────────

    [Fact] public async Task TheEmailer_SendsOneMessageToEachMember_AndKeepsGoingPastABadAddress()
    {
        var directory = Substitute.For<ISocietyDirectory>();
        directory.MemberEmailsAsync(Society, Arg.Any<CancellationToken>()).Returns(new[] { "asha@x.in", "bad@x.in", "bhaskar@x.in" });
        var email = Substitute.For<INotificationChannel>();
        email.ChannelName.Returns("email"); email.IsEnabled.Returns(true);
        email.SendAsync(Arg.Is<NotificationMessage>(m => m.Recipient == "bad@x.in"), Arg.Any<CancellationToken>()).ThrowsAsync(new InvalidOperationException("mailbox full"));
        email.SendAsync(Arg.Is<NotificationMessage>(m => m.Recipient != "bad@x.in"), Arg.Any<CancellationToken>()).Returns(true);

        var sent = await new NoticeEmailer(directory, new[] { email }, NullLogger<NoticeEmailer>.Instance)
            .SendAsync(new NoticeEmail(Society, "Water cut", "Off from 10 to 2.", "Notice"), default);

        sent.Should().Be(2);
        await email.Received(1).SendAsync(Arg.Is<NotificationMessage>(m => m.Recipient == "asha@x.in" && m.Subject == "Notice: Water cut" && m.Body == "Off from 10 to 2."), Arg.Any<CancellationToken>());
    }

    [Fact] public async Task WithNoEmailServiceSetUp_NothingIsSent()
    {
        var directory = Substitute.For<ISocietyDirectory>();
        var off = Substitute.For<INotificationChannel>();
        off.ChannelName.Returns("email"); off.IsEnabled.Returns(false);

        (await new NoticeEmailer(directory, new[] { off }, NullLogger<NoticeEmailer>.Instance).SendAsync(new NoticeEmail(Society, "t", "b", "Notice"), default)).Should().Be(0);
        await directory.DidNotReceiveWithAnyArgs().MemberEmailsAsync(default, default);
    }

    [Fact] public async Task AnEmergencyEmail_SaysSoInTheSubject()
    {
        var directory = Substitute.For<ISocietyDirectory>();
        directory.MemberEmailsAsync(Society, Arg.Any<CancellationToken>()).Returns(new[] { "a@x.in" });
        var email = Substitute.For<INotificationChannel>();
        email.ChannelName.Returns("email"); email.IsEnabled.Returns(true); email.SendAsync(Arg.Any<NotificationMessage>(), Arg.Any<CancellationToken>()).Returns(true);

        await new NoticeEmailer(directory, new[] { email }, NullLogger<NoticeEmailer>.Instance).SendAsync(new NoticeEmail(Society, "Fire", "Leave now", "Emergency"), default);

        await email.Received(1).SendAsync(Arg.Is<NotificationMessage>(m => m.Subject == "Emergency: Fire"), Arg.Any<CancellationToken>());
    }

    // ── The dispatcher follows the switches ───────────────────────────────────

    private sealed class Dispatch
    {
        public IPushTokenStore Tokens = Substitute.For<IPushTokenStore>();
        public INotificationChannel Sms = Substitute.For<INotificationChannel>();
        public FallbackNotificationDispatcher Dispatcher;

        public Dispatch(SocietySettings rules, bool pushFails)
        {
            Tokens.GetTokensAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(new List<string>());   // a phone with nobody registered: push has nothing to do, and that is a success
            if (pushFails) Tokens.GetTokensAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).ThrowsAsync(new InvalidOperationException("push service down"));
            Sms.ChannelName.Returns("sms"); Sms.IsEnabled.Returns(true); Sms.SendAsync(Arg.Any<NotificationMessage>(), Arg.Any<CancellationToken>()).Returns(true);
            var push = new ExpoPushChannel(Substitute.For<IHttpClientFactory>(), Tokens, NullLogger<ExpoPushChannel>.Instance);
            Dispatcher = new FallbackNotificationDispatcher(push, new[] { Sms }, NullLogger<FallbackNotificationDispatcher>.Instance, Rules(rules));
        }

        public Task<string?> Send(Guid? society) => Dispatcher.DispatchAsync(new NotificationMessage(Guid.NewGuid().ToString(), "s", "b", null, null, society), "+919975001173");
    }

    [Fact] public async Task WithPushOff_ASocietysMessageDoesNotTryPush()
    {
        var d = new Dispatch(new SocietySettings { PushEnabled = false, SmsEnabled = false }, pushFails: false);
        (await d.Send(Society)).Should().BeNull();
        await d.Tokens.DidNotReceiveWithAnyArgs().GetTokensAsync(default, default);
    }

    [Fact] public async Task WithPushOn_ItTriesPush()
    {
        var d = new Dispatch(new SocietySettings { PushEnabled = true }, pushFails: false);
        (await d.Send(Society)).Should().Be("push");
    }

    [Fact] public async Task SmsIsTheFallback_OnlyWhenTheSocietyAllowsSms()
    {
        var allowed = new Dispatch(new SocietySettings { PushEnabled = true, SmsEnabled = true }, pushFails: true);
        (await allowed.Send(Society)).Should().Be("sms");

        var blocked = new Dispatch(new SocietySettings { PushEnabled = true, SmsEnabled = false }, pushFails: true);
        (await blocked.Send(Society)).Should().BeNull();
        await blocked.Sms.DidNotReceiveWithAnyArgs().SendAsync(default!, default);
    }

    [Fact] public async Task AMessageWithNoSociety_KeepsTheOldBehaviour_PushThenSms()
    {
        var d = new Dispatch(new SocietySettings { PushEnabled = false, SmsEnabled = false }, pushFails: true);
        (await d.Send(null)).Should().Be("sms");
    }
}
