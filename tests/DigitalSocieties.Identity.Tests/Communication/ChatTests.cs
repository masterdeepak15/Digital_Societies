using Xunit;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Communication.Application.Chat;
using DigitalSocieties.Communication.Application.Commands;
using DigitalSocieties.Communication.Application.Queries;
using DigitalSocieties.Communication.Infrastructure.Persistence;

namespace DigitalSocieties.Identity.Tests.Communication;

/// <summary>WhatsApp-style chat between neighbours: one-to-one and group, text and pictures, ticks, unread counts.</summary>
public class ChatTests
{
    private static readonly Guid Society = Guid.NewGuid();
    private static readonly Guid Asha    = Guid.NewGuid();
    private static readonly Guid Bhaskar = Guid.NewGuid();
    private static readonly Guid Chitra  = Guid.NewGuid();
    private static readonly Guid Outsider = Guid.NewGuid();   // lives in another society

    private sealed class Fixture
    {
        public CommunicationDbContext Db = new(new DbContextOptionsBuilder<CommunicationDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options, As(Asha));
        public IChatNotifier Notifier = Substitute.For<IChatNotifier>();
        public IChatPresence Presence = Substitute.For<IChatPresence>();
        public IChatDirectory Directory = Substitute.For<IChatDirectory>();

        public Fixture()
        {
            Directory.ListAsync(Society, Arg.Any<CancellationToken>()).Returns(new List<ChatPerson>
            {
                new(Asha, "Asha Patil", "A-807"), new(Bhaskar, "Bhaskar Rao", "A-101"), new(Chitra, "Chitra Nair", "B-202"),
            });
            Directory.ListAsync(Arg.Is<Guid>(s => s != Society), Arg.Any<CancellationToken>()).Returns(new List<ChatPerson> { new(Outsider, "Out Sider", "Z-1") });
        }

        public async Task<Guid> Direct(Guid me, Guid other) =>
            (await new StartDirectChatHandler(Db, As(me), Directory, Notifier).Handle(new StartDirectChatCommand(other), default)).Value;

        public async Task<Guid> Group(Guid me, string title, params Guid[] others) =>
            (await new CreateGroupHandler(Db, As(me), Directory, Notifier).Handle(new CreateGroupCommand(title, others.ToList()), default)).Value;

        public Task<DigitalSocieties.Shared.Results.Result<ChatMessageDto>> Send(Guid me, Guid conv, string body, Guid? clientId = null, string kind = "Text", string? media = null, Guid? society = null) =>
            new SendChatMessageHandler(Db, As(me, society), Notifier, Directory).Handle(new SendChatMessageCommand(conv, clientId ?? Guid.NewGuid(), kind, body, media), default);

        public Task Read(Guid me, Guid conv) => new MarkChatReadHandler(Db, As(me), Notifier).Handle(new MarkChatReadCommand(conv), default);
        public Task Delivered(Guid me, Guid? conv = null) => new MarkChatDeliveredHandler(Db, As(me), Notifier).Handle(new MarkChatDeliveredCommand(conv), default);

        public async Task<List<ChatMessageDto>> Messages(Guid me, Guid conv, DateTimeOffset? before = null, int limit = 50) =>
            (await new GetChatMessagesHandler(Db, As(me), Directory).Handle(new GetChatMessagesQuery(conv, before, limit), default)).Value!;

        public async Task<List<ConversationDto>> List(Guid me) =>
            (await new GetConversationsHandler(Db, As(me), Directory, Presence).Handle(new GetConversationsQuery(), default)).Value!;
    }

    private static ICurrentUser As(Guid user, Guid? society = null)
    {
        var cu = Substitute.For<ICurrentUser>();
        cu.UserId.Returns(user);
        cu.SocietyId.Returns(society ?? Society);
        cu.IsInRole(Arg.Any<string>()).Returns(false);
        return cu;
    }

    // ── Starting chats ─────────────────────────────────────────────────────────

    [Fact] public async Task AOneToOneChat_ExistsOncePerPair_WhoeverStartsIt()
    {
        var f = new Fixture();
        var a = await f.Direct(Asha, Bhaskar);
        var b = await f.Direct(Bhaskar, Asha);
        var again = await f.Direct(Asha, Bhaskar);

        b.Should().Be(a);
        again.Should().Be(a);
        (await f.Db.Conversations.CountAsync()).Should().Be(1);
        (await f.Db.ConversationMembers.CountAsync()).Should().Be(2);
    }

    [Fact] public async Task YouCannotChatWithYourself_OrWithSomeoneOutsideTheSociety()
    {
        var f = new Fixture();
        (await new StartDirectChatHandler(f.Db, As(Asha), f.Directory, f.Notifier).Handle(new StartDirectChatCommand(Asha), default)).Error!.Code.Should().Be("CHAT.SELF");
        (await new StartDirectChatHandler(f.Db, As(Asha), f.Directory, f.Notifier).Handle(new StartDirectChatCommand(Outsider), default)).Error!.Code.Should().Be("CHAT.NOT_A_MEMBER");
        (await f.Db.Conversations.CountAsync()).Should().Be(0);
    }

    [Fact] public async Task AGroup_NeedsANameAndSomeoneElse_AndTheCreatorIsItsAdmin()
    {
        var f = new Fixture();
        new CreateGroupValidator().Validate(new CreateGroupCommand("  ", new() { Bhaskar })).IsValid.Should().BeFalse();
        new CreateGroupValidator().Validate(new CreateGroupCommand("Wing A", new())).IsValid.Should().BeFalse();

        var id = await f.Group(Asha, "Wing A", Bhaskar, Chitra, Bhaskar);        // a repeated person counts once

        var members = await f.Db.ConversationMembers.Where(m => m.ConversationId == id).ToListAsync();
        members.Should().HaveCount(3);
        members.Single(m => m.UserId == Asha).IsAdmin.Should().BeTrue();
        members.Where(m => m.UserId != Asha).Should().OnlyContain(m => !m.IsAdmin);
    }

    [Fact] public async Task AGroup_RefusesPeopleFromOutsideTheSociety()
    {
        var f = new Fixture();
        var r = await new CreateGroupHandler(f.Db, As(Asha), f.Directory, f.Notifier).Handle(new CreateGroupCommand("Wing A", new() { Bhaskar, Outsider }), default);
        r.Error!.Code.Should().Be("CHAT.NOT_A_MEMBER");
        (await f.Db.Conversations.CountAsync()).Should().Be(0);
    }

    [Fact] public async Task OnlyAGroupAdmin_CanAddPeople_AndOnlyToAGroup()
    {
        var f = new Fixture();
        var g = await f.Group(Asha, "Wing A", Bhaskar);
        var d = await f.Direct(Asha, Chitra);

        (await new AddGroupMembersHandler(f.Db, As(Bhaskar), f.Directory, f.Notifier).Handle(new AddGroupMembersCommand(g, new() { Chitra }), default)).Error!.Code.Should().Be("FORBIDDEN");
        (await new AddGroupMembersHandler(f.Db, As(Asha), f.Directory, f.Notifier).Handle(new AddGroupMembersCommand(d, new() { Bhaskar }), default)).Error!.Code.Should().Be("CHAT.NOT_A_GROUP");
        (await new AddGroupMembersHandler(f.Db, As(Asha), f.Directory, f.Notifier).Handle(new AddGroupMembersCommand(g, new() { Chitra }), default)).IsSuccess.Should().BeTrue();

        (await f.Db.ConversationMembers.CountAsync(m => m.ConversationId == g && m.LeftAt == null)).Should().Be(3);
    }

    // ── Sending ────────────────────────────────────────────────────────────────

    [Fact] public async Task AMessage_IsStored_ShowsAsThePreview_AndIsPushedToTheOthersOnly()
    {
        var f = new Fixture();
        var c = await f.Group(Asha, "Wing A", Bhaskar, Chitra);

        var sent = await f.Send(Asha, c, "  Meeting at 6 😊  ");

        sent.IsSuccess.Should().BeTrue();
        (sent.Value!.Body, sent.Value.IsMine, sent.Value.Status, sent.Value.SenderName).Should().Be(("Meeting at 6 😊", true, "Sent", "Asha Patil"));
        var conv = await f.Db.Conversations.SingleAsync();
        (conv.LastMessagePreview, conv.LastMessageSenderId).Should().Be(("Meeting at 6 😊", Asha));
        await f.Notifier.Received(1).MessageSentAsync(Society, Arg.Is<ChatMessageDto>(m => m.Body == "Meeting at 6 😊"), "Wing A",
            Arg.Is<IReadOnlyList<Guid>>(r => r.Count == 2 && r.Contains(Bhaskar) && r.Contains(Chitra) && !r.Contains(Asha)), Arg.Any<CancellationToken>());
    }

    [Fact] public async Task ARetriedMessage_IsStoredOnce()
    {
        var f = new Fixture();
        var c = await f.Direct(Asha, Bhaskar);
        var client = Guid.NewGuid();

        var first = await f.Send(Asha, c, "Hello", client);
        var retry = await f.Send(Asha, c, "Hello", client);

        retry.Value!.Id.Should().Be(first.Value!.Id);
        (await f.Db.ChatMessages.CountAsync()).Should().Be(1);
        await f.Notifier.Received(1).MessageSentAsync(Arg.Any<Guid>(), Arg.Any<ChatMessageDto>(), Arg.Any<string>(), Arg.Any<IReadOnlyList<Guid>>(), Arg.Any<CancellationToken>());
    }

    [Fact] public async Task OnlyMembers_CanSend_ReadOrOpenAConversation()
    {
        var f = new Fixture();
        var c = await f.Direct(Asha, Bhaskar);

        (await f.Send(Chitra, c, "Hi")).Error!.Code.Should().Be("FORBIDDEN");
        (await f.Send(Outsider, c, "Hi", society: Guid.NewGuid())).Error!.Code.Should().Be("CHAT.NOT_FOUND");
        (await new GetChatMessagesHandler(f.Db, As(Chitra), f.Directory).Handle(new GetChatMessagesQuery(c, null, 50), default)).Error!.Code.Should().Be("FORBIDDEN");
        (await f.Db.ChatMessages.CountAsync()).Should().Be(0);
    }

    [Fact] public async Task TheSendRules_CheckKindAndBody()
    {
        var f = new Fixture();
        var c = await f.Direct(Asha, Bhaskar);
        var v = new SendChatMessageValidator();

        v.Validate(new SendChatMessageCommand(c, Guid.NewGuid(), "Text", "Hi", null)).IsValid.Should().BeTrue();
        v.Validate(new SendChatMessageCommand(c, Guid.NewGuid(), "Text", "  ", null)).IsValid.Should().BeFalse();                 // empty text
        v.Validate(new SendChatMessageCommand(c, Guid.NewGuid(), "Text", new string('x', 4001), null)).IsValid.Should().BeFalse(); // too long
        v.Validate(new SendChatMessageCommand(c, Guid.NewGuid(), "Image", "", null)).IsValid.Should().BeFalse();                   // no picture
        v.Validate(new SendChatMessageCommand(c, Guid.NewGuid(), "Image", "", "abc")).IsValid.Should().BeTrue();                   // a picture needs no caption
        v.Validate(new SendChatMessageCommand(c, Guid.NewGuid(), "Video", "x", null)).IsValid.Should().BeFalse();
    }

    [Fact] public async Task APicture_ShowsAsAPhotoInTheList()
    {
        var f = new Fixture();
        var c = await f.Direct(Asha, Bhaskar);
        await f.Send(Asha, c, "", kind: "Image", media: "img-1");

        (await f.List(Bhaskar)).Single().LastMessagePreview.Should().Be("📷 Photo");
        (await f.Messages(Bhaskar, c)).Single().MediaId.Should().Be("img-1");
    }

    // ── Ticks ──────────────────────────────────────────────────────────────────

    [Fact] public async Task Ticks_GoFromSentToDeliveredToRead_InAOneToOneChat()
    {
        var f = new Fixture();
        var c = await f.Direct(Asha, Bhaskar);
        await f.Send(Asha, c, "Hi");
        (await f.Messages(Asha, c)).Single().Status.Should().Be("Sent");

        await f.Delivered(Bhaskar, c);
        (await f.Messages(Asha, c)).Single().Status.Should().Be("Delivered");

        await f.Read(Bhaskar, c);
        (await f.Messages(Asha, c)).Single().Status.Should().Be("Read");
        await f.Notifier.Received().ReceiptAsync(c, Bhaskar, "read", Arg.Any<DateTimeOffset>(), Arg.Is<IReadOnlyList<Guid>>(n => n.Contains(Asha)), Arg.Any<CancellationToken>());
    }

    [Fact] public async Task InAGroup_AMessageIsReadOnlyWhenEveryoneElseHasRead()
    {
        var f = new Fixture();
        var c = await f.Group(Asha, "Wing A", Bhaskar, Chitra);
        await f.Send(Asha, c, "Hi all");

        await f.Read(Bhaskar, c);
        (await f.Messages(Asha, c)).Single().Status.Should().Be("Sent");             // Chitra's phone has not got it yet
        await f.Delivered(Chitra, c);
        (await f.Messages(Asha, c)).Single().Status.Should().Be("Delivered");        // everyone has it, Chitra has not read it
        await f.Read(Chitra, c);
        (await f.Messages(Asha, c)).Single().Status.Should().Be("Read");
    }

    [Fact] public async Task AMessageFromSomeoneElse_HasNoTickStatusForYou_AndAMessageAfterTheReadPointIsUnread()
    {
        var f = new Fixture();
        var c = await f.Direct(Asha, Bhaskar);
        await f.Send(Asha, c, "one");
        await f.Read(Bhaskar, c);
        await Task.Delay(20);
        await f.Send(Asha, c, "two");

        var seenByAsha = await f.Messages(Asha, c);
        seenByAsha.Select(m => m.Status).Should().Equal("Read", "Sent");
        (await f.Messages(Bhaskar, c)).Should().OnlyContain(m => !m.IsMine);
        (await f.List(Bhaskar)).Single().UnreadCount.Should().Be(1);
    }

    [Fact] public async Task ADeliveryAcknowledgementThatArrivesLate_NeverUndoesAReadTick()
    {
        var f = new Fixture();
        var c = await f.Direct(Asha, Bhaskar);
        await f.Send(Asha, c, "Hi");
        await f.Read(Bhaskar, c);
        var before = (await f.Db.ConversationMembers.SingleAsync(m => m.UserId == Bhaskar)).LastReadAt;

        await f.Delivered(Bhaskar, c);

        (await f.Db.ConversationMembers.SingleAsync(m => m.UserId == Bhaskar)).LastReadAt.Should().Be(before);
        (await f.Messages(Asha, c)).Single().Status.Should().Be("Read");
    }

    [Fact] public async Task WhenThePhoneComesOnline_EverythingWaitingIsMarkedDelivered()
    {
        var f = new Fixture();
        var one = await f.Direct(Asha, Bhaskar);
        var two = await f.Group(Chitra, "Wing B", Bhaskar);
        await f.Send(Asha, one, "a");
        await f.Send(Chitra, two, "b");

        await f.Delivered(Bhaskar);                                  // no conversation id: all of mine

        (await f.Messages(Asha, one)).Single().Status.Should().Be("Delivered");
        (await f.Messages(Chitra, two)).Single().Status.Should().Be("Delivered");
    }

    // ── Lists ──────────────────────────────────────────────────────────────────

    [Fact] public async Task TheList_ShowsTheOtherPersonsName_NewestFirst_WithUnreadCounts_AndWhoIsOnline()
    {
        var f = new Fixture();
        f.Presence.IsOnline(Bhaskar).Returns(true);
        var withBhaskar = await f.Direct(Asha, Bhaskar);
        var wing = await f.Group(Chitra, "Wing B", Asha);
        await f.Send(Bhaskar, withBhaskar, "Hello");
        await Task.Delay(20);
        await f.Send(Chitra, wing, "Welcome");
        await Task.Delay(20);
        await f.Send(Chitra, wing, "Rules in the pinned note");

        var list = await f.List(Asha);

        list.Select(c => c.Title).Should().Equal("Wing B", "Bhaskar Rao");
        list[0].UnreadCount.Should().Be(2);
        list[1].UnreadCount.Should().Be(1);
        list[1].OtherUserId.Should().Be(Bhaskar);
        list[1].IsOnline.Should().BeTrue();
        list[0].MemberCount.Should().Be(2);

        await f.Read(Asha, wing);
        (await f.List(Asha)).First(c => c.Title == "Wing B").UnreadCount.Should().Be(0);
    }

    [Fact] public async Task YourOwnMessages_AreNeverUnread()
    {
        var f = new Fixture();
        var c = await f.Direct(Asha, Bhaskar);
        await f.Send(Asha, c, "Hi");
        (await f.List(Asha)).Single().UnreadCount.Should().Be(0);
    }

    [Fact] public async Task ChatsOfAnotherSociety_NeverAppear()
    {
        var f = new Fixture();
        await f.Direct(Asha, Bhaskar);
        var other = await new GetConversationsHandler(f.Db, As(Asha, Guid.NewGuid()), f.Directory, f.Presence).Handle(new GetConversationsQuery(), default);
        other.Value.Should().BeEmpty();
    }

    [Fact] public async Task AMessagePage_IsInOrder_AndWalksBackwardsFromACursor()
    {
        var f = new Fixture();
        var c = await f.Direct(Asha, Bhaskar);
        for (var i = 1; i <= 5; i++) { await f.Send(Asha, c, $"m{i}"); await Task.Delay(5); }

        var latest = await f.Messages(Asha, c, limit: 2);
        latest.Select(m => m.Body).Should().Equal("m4", "m5");

        var older = await f.Messages(Asha, c, before: latest[0].SentAt, limit: 2);
        older.Select(m => m.Body).Should().Equal("m2", "m3");
    }

    // ── Leaving ────────────────────────────────────────────────────────────────

    [Fact] public async Task WhoLeavesAGroup_NoLongerSeesItOrSendsToIt()
    {
        var f = new Fixture();
        var c = await f.Group(Asha, "Wing A", Bhaskar, Chitra);

        (await new LeaveConversationHandler(f.Db, As(Bhaskar), f.Notifier).Handle(new LeaveConversationCommand(c), default)).IsSuccess.Should().BeTrue();

        (await f.List(Bhaskar)).Should().BeEmpty();
        (await f.Send(Bhaskar, c, "still here?")).Error!.Code.Should().Be("FORBIDDEN");
        (await f.Send(Asha, c, "bye")).IsSuccess.Should().BeTrue();
        await f.Notifier.Received().MessageSentAsync(Society, Arg.Any<ChatMessageDto>(), "Wing A", Arg.Is<IReadOnlyList<Guid>>(r => !r.Contains(Bhaskar)), Arg.Any<CancellationToken>());
    }

    [Fact] public async Task ADirectChat_CannotBeLeft()
    {
        var f = new Fixture();
        var c = await f.Direct(Asha, Bhaskar);
        (await new LeaveConversationHandler(f.Db, As(Asha), f.Notifier).Handle(new LeaveConversationCommand(c), default)).Error!.Code.Should().Be("CHAT.NOT_A_GROUP");
    }

    // ── People ─────────────────────────────────────────────────────────────────

    [Fact] public async Task ThePeopleList_LeavesOutYou_AndCanBeSearchedByNameOrFlat()
    {
        var f = new Fixture();
        var all = (await new GetChatPeopleHandler(As(Asha), f.Directory).Handle(new GetChatPeopleQuery(null), default)).Value!;
        all.Select(p => p.Name).Should().BeEquivalentTo("Bhaskar Rao", "Chitra Nair");

        (await new GetChatPeopleHandler(As(Asha), f.Directory).Handle(new GetChatPeopleQuery("b-2"), default)).Value!.Select(p => p.Name).Should().Equal("Chitra Nair");
        (await new GetChatPeopleHandler(As(Asha), f.Directory).Handle(new GetChatPeopleQuery("rao"), default)).Value!.Select(p => p.Name).Should().Equal("Bhaskar Rao");
    }

    [Fact] public async Task TheMemberList_ShowsNamesAndFlats_ToMembersOnly_AndDropsThoseWhoLeft()
    {
        var f = new Fixture();
        var c = await f.Group(Asha, "Wing A", Bhaskar, Chitra);
        await new LeaveConversationHandler(f.Db, As(Chitra), f.Notifier).Handle(new LeaveConversationCommand(c), default);

        var list = (await new GetConversationMembersHandler(f.Db, As(Bhaskar), f.Directory).Handle(new GetConversationMembersQuery(c), default)).Value!;

        list.Select(m => (m.Name, m.Flat, m.IsAdmin, m.IsMe)).Should().Equal(("Asha Patil", "A-807", true, false), ("Bhaskar Rao", "A-101", false, true));
        (await new GetConversationMembersHandler(f.Db, As(Chitra), f.Directory).Handle(new GetConversationMembersQuery(c), default)).Error!.Code.Should().Be("FORBIDDEN");
    }

    [Fact] public async Task WhenTheOnlyAdminLeaves_TheLongestStandingMemberTakesOver()
    {
        var f = new Fixture();
        var c = await f.Group(Asha, "Wing A", Bhaskar, Chitra);
        await new LeaveConversationHandler(f.Db, As(Asha), f.Notifier).Handle(new LeaveConversationCommand(c), default);
        (await f.Db.ConversationMembers.Where(m => m.ConversationId == c && m.LeftAt == null && m.IsAdmin).CountAsync()).Should().Be(1);
    }
}
