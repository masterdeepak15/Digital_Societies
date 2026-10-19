using Xunit;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Marketplace.Application.Commands;
using DigitalSocieties.Marketplace.Application.Queries;
using DigitalSocieties.Marketplace.Infrastructure.Persistence;

namespace DigitalSocieties.Identity.Tests.Marketplace;

/// <summary>Residents post what they want to sell, buy or borrow; neighbours reply; the author closes the deal.</summary>
public class MarketPostTests
{
    private static readonly Guid Society = Guid.NewGuid();
    private static readonly Guid Asha    = Guid.NewGuid();
    private static readonly Guid Bhaskar = Guid.NewGuid();
    private static readonly Guid Chitra  = Guid.NewGuid();
    private static readonly Guid Admin   = Guid.NewGuid();

    private static MarketplaceDbContext NewDb()
        => new(new DbContextOptionsBuilder<MarketplaceDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static ICurrentUser As(Guid user, bool admin = false, Guid? society = null)
    {
        var cu = Substitute.For<ICurrentUser>();
        cu.SocietyId.Returns(society ?? Society);
        cu.UserId.Returns(user);
        cu.FlatId.Returns(admin ? (Guid?)null : Guid.NewGuid());
        cu.IsInRole("admin").Returns(admin);
        return cu;
    }

    private static CreateMarketPostCommand Bicycle(string kind = "Sell", decimal? price = 2500m) =>
        new(kind, "Kids bicycle", "Hardly used, 20 inch", price, "good", new List<string> { "img-1" });

    private static async Task<Guid> Post(MarketplaceDbContext db, Guid user, string kind = "Sell", decimal? price = 2500m)
        => (await new CreateMarketPostHandler(db, As(user)).Handle(Bicycle(kind, price), default)).Value;

    private static Task<IReadOnlyList<MarketPostDto>> List(MarketplaceDbContext db, Guid viewer, string? kind = null, string? status = null, bool mine = false, bool admin = false)
        => new GetMarketPostsHandler(db, As(viewer, admin)).Handle(new GetMarketPostsQuery(kind, status, mine, 1, 50), default)
            .ContinueWith(t => (IReadOnlyList<MarketPostDto>)t.Result.Value!);

    private static async Task Reply(MarketplaceDbContext db, Guid postId, Guid user, string body = "Is it still available?")
        => (await new AddMarketReplyHandler(db, As(user)).Handle(new AddMarketReplyCommand(postId, body), default)).IsSuccess.Should().BeTrue();

    // ── Posting ────────────────────────────────────────────────────────────────

    [Fact] public async Task APost_IsSavedOpen_ForTheAuthorsSociety_AndEveryoneSeesIt()
    {
        var db = NewDb();
        await Post(db, Asha);

        var seen = await List(db, Bhaskar);

        seen.Should().ContainSingle();
        var p = seen[0];
        (p.Kind, p.Title, p.PriceRupees, p.Status, p.IsMine, p.ReplyCount).Should().Be(("Sell", "Kids bicycle", 2500m, "Open", false, 0));
        (await List(db, Asha)).Single().IsMine.Should().BeTrue();
    }

    [Fact] public async Task PostsOfAnotherSociety_AreNeverShown()
    {
        var db = NewDb();
        await Post(db, Asha);
        var other = new GetMarketPostsHandler(db, As(Bhaskar, society: Guid.NewGuid()));
        (await other.Handle(new GetMarketPostsQuery(null, null, false, 1, 50), default)).Value.Should().BeEmpty();
    }

    [Theory]
    [InlineData("Sell", 2500, "good", 2500, "good")]
    [InlineData("Wanted", 1500, "good", 1500, null)]     // a budget, and no condition
    [InlineData("Borrow", 900, "good", null, null)]      // borrowing has no price
    public async Task EachKind_KeepsOnlyWhatMakesSenseForIt(string kind, int price, string condition, int? savedPrice, string? savedCondition)
    {
        var db = NewDb();
        await new CreateMarketPostHandler(db, As(Asha)).Handle(new(kind, "Thing", "", price, condition, null), default);
        var p = await db.MarketPosts.SingleAsync();
        (p.PricePaise, p.Condition).Should().Be((savedPrice * 100L, savedCondition));
    }

    [Fact] public void TheValidator_ChecksTheDetails()
    {
        var v = new CreateMarketPostValidator();
        v.Validate(Bicycle()).IsValid.Should().BeTrue();
        v.Validate(Bicycle("Swap")).IsValid.Should().BeFalse();
        v.Validate(Bicycle() with { Title = "ab" }).IsValid.Should().BeFalse();
        v.Validate(Bicycle(price: -5m)).IsValid.Should().BeFalse();
        v.Validate(Bicycle() with { Description = new string('x', 1001) }).IsValid.Should().BeFalse();
    }

    [Fact] public async Task AtMostFourPictures_AreKept()
    {
        var db = NewDb();
        var many = new CreateMarketPostCommand("Sell", "Sofa", "", 5000m, null, new List<string> { "a", "b", "c", "d", "e", "a" });
        await new CreateMarketPostHandler(db, As(Asha)).Handle(many, default);
        (await db.MarketPosts.SingleAsync()).ImageIds.Should().Equal("a", "b", "c", "d");
    }

    [Fact] public async Task TheFilters_NarrowTheList()
    {
        var db = NewDb();
        await Post(db, Asha, "Sell");
        await Post(db, Bhaskar, "Wanted");
        var borrow = await Post(db, Bhaskar, "Borrow", null);
        await new CloseMarketPostHandler(db, As(Bhaskar)).Handle(new CloseMarketPostCommand(borrow, null), default);

        (await List(db, Asha, kind: "Wanted")).Should().ContainSingle(p => p.Kind == "Wanted");
        (await List(db, Asha, status: "Closed")).Should().ContainSingle(p => p.Kind == "Borrow");
        (await List(db, Asha, mine: true)).Should().ContainSingle(p => p.Kind == "Sell");
        (await List(db, Asha)).Should().HaveCount(3);
        (await List(db, Asha)).Last().Status.Should().Be("Closed");                         // open posts come first
    }

    // ── Replies ────────────────────────────────────────────────────────────────

    [Fact] public async Task ANeighbour_CanReply_AndEveryoneSeesTheThread()
    {
        var db = NewDb();
        var id = await Post(db, Asha);
        await Reply(db, id, Bhaskar, "Is it still available?");
        await Reply(db, id, Asha, "Yes, come after 6.");

        var detail = (await new GetMarketPostHandler(db, As(Chitra)).Handle(new GetMarketPostQuery(id), default)).Value!;

        detail.Replies.Select(r => r.Body).Should().Equal("Is it still available?", "Yes, come after 6.");
        detail.Replies.Select(r => r.IsMine).Should().Equal(false, false);
        (await List(db, Chitra)).Single().ReplyCount.Should().Be(2);
    }

    [Fact] public void AnEmptyReply_IsRefused()
        => new AddMarketReplyValidator().Validate(new AddMarketReplyCommand(Guid.NewGuid(), "  ")).IsValid.Should().BeFalse();

    [Fact] public async Task ACloseDeal_TakesNoMoreReplies()
    {
        var db = NewDb();
        var id = await Post(db, Asha);
        await new CloseMarketPostHandler(db, As(Asha)).Handle(new CloseMarketPostCommand(id, null), default);

        var r = await new AddMarketReplyHandler(db, As(Bhaskar)).Handle(new AddMarketReplyCommand(id, "Too late?"), default);

        r.Error!.Code.Should().Be("MARKET.CLOSED");
    }

    [Fact] public async Task ReplyingToAnotherSocietysPost_IsRefused()
    {
        var db = NewDb();
        var id = await Post(db, Asha);
        var r = await new AddMarketReplyHandler(db, As(Bhaskar, society: Guid.NewGuid())).Handle(new AddMarketReplyCommand(id, "Hi"), default);
        r.Error!.Code.Should().Be("MARKET.NOT_FOUND");
    }

    [Fact] public async Task ARepliesAuthor_ThePostAuthor_AndAdmin_CanRemoveAReply_OthersCannot()
    {
        var db = NewDb();
        var id = await Post(db, Asha);
        await Reply(db, id, Bhaskar, "one");
        await Reply(db, id, Bhaskar, "two");
        await Reply(db, id, Bhaskar, "three");
        var ids = await db.MarketReplies.OrderBy(r => r.CreatedAt).Select(r => r.Id).ToListAsync();

        (await new DeleteMarketReplyHandler(db, As(Chitra)).Handle(new DeleteMarketReplyCommand(ids[0]), default)).Error!.Code.Should().Be("FORBIDDEN");
        (await new DeleteMarketReplyHandler(db, As(Bhaskar)).Handle(new DeleteMarketReplyCommand(ids[0]), default)).IsSuccess.Should().BeTrue();
        (await new DeleteMarketReplyHandler(db, As(Asha)).Handle(new DeleteMarketReplyCommand(ids[1]), default)).IsSuccess.Should().BeTrue();
        (await new DeleteMarketReplyHandler(db, As(Admin, admin: true)).Handle(new DeleteMarketReplyCommand(ids[2]), default)).IsSuccess.Should().BeTrue();

        (await new GetMarketPostHandler(db, As(Asha)).Handle(new GetMarketPostQuery(id), default)).Value!.Replies.Should().BeEmpty();
    }

    // ── Closing the deal ───────────────────────────────────────────────────────

    [Fact] public async Task TheAuthor_ClosesTheDeal_WithTheNeighbourThePickedFromTheReplies()
    {
        var db = NewDb();
        var id = await Post(db, Asha);
        await Reply(db, id, Bhaskar);

        var done = await new CloseMarketPostHandler(db, As(Asha)).Handle(new CloseMarketPostCommand(id, Bhaskar), default);

        done.IsSuccess.Should().BeTrue();
        var p = await db.MarketPosts.SingleAsync();
        (p.Status.ToString(), p.ClosedWithUserId, p.ClosedAt.HasValue).Should().Be(("Closed", Bhaskar, true));
    }

    [Fact] public async Task TheDealCannotBeClosedWith_SomeoneWhoNeverReplied()
    {
        var db = NewDb();
        var id = await Post(db, Asha);

        var r = await new CloseMarketPostHandler(db, As(Asha)).Handle(new CloseMarketPostCommand(id, Chitra), default);

        r.Error!.Code.Should().Be("MARKET.NOT_A_REPLIER");
        (await db.MarketPosts.SingleAsync()).Status.ToString().Should().Be("Open");
    }

    [Fact] public async Task OnlyTheAuthorOrAnAdmin_CanCloseReopenEditOrDelete()
    {
        var db = NewDb();
        var id = await Post(db, Asha);
        var edit = new UpdateMarketPostCommand(id, "Sell", "Hijack", "", 1m, null, null);

        (await new CloseMarketPostHandler(db, As(Bhaskar)).Handle(new CloseMarketPostCommand(id, null), default)).Error!.Code.Should().Be("FORBIDDEN");
        (await new UpdateMarketPostHandler(db, As(Bhaskar)).Handle(edit, default)).Error!.Code.Should().Be("FORBIDDEN");
        (await new DeleteMarketPostHandler(db, As(Bhaskar)).Handle(new DeleteMarketPostCommand(id), default)).Error!.Code.Should().Be("FORBIDDEN");
        (await db.MarketPosts.SingleAsync()).Title.Should().Be("Kids bicycle");

        (await new CloseMarketPostHandler(db, As(Admin, admin: true)).Handle(new CloseMarketPostCommand(id, null), default)).IsSuccess.Should().BeTrue();
        (await new ReopenMarketPostHandler(db, As(Bhaskar)).Handle(new ReopenMarketPostCommand(id), default)).Error!.Code.Should().Be("FORBIDDEN");
        (await new ReopenMarketPostHandler(db, As(Asha)).Handle(new ReopenMarketPostCommand(id), default)).IsSuccess.Should().BeTrue();
        (await db.MarketPosts.SingleAsync()).Status.ToString().Should().Be("Open");
    }

    [Fact] public async Task TheAuthor_CanChangeAnOpenPost_ButNotAClosedOne()
    {
        var db = NewDb();
        var id = await Post(db, Asha);
        var edit = new UpdateMarketPostCommand(id, "Sell", "Kids bicycle", "Now with a bell", 2000m, "like_new", null);

        (await new UpdateMarketPostHandler(db, As(Asha)).Handle(edit, default)).IsSuccess.Should().BeTrue();
        var p = await db.MarketPosts.SingleAsync();
        (p.Description, p.PricePaise, p.Condition).Should().Be(("Now with a bell", 200_000L, "like_new"));

        await new CloseMarketPostHandler(db, As(Asha)).Handle(new CloseMarketPostCommand(id, null), default);
        (await new UpdateMarketPostHandler(db, As(Asha)).Handle(edit, default)).Error!.Code.Should().Be("MARKET.CLOSED");
    }

    [Fact] public async Task ADeletedPost_DisappearsWithItsReplies()
    {
        var db = NewDb();
        var id = await Post(db, Asha);
        await Reply(db, id, Bhaskar);

        (await new DeleteMarketPostHandler(db, As(Asha)).Handle(new DeleteMarketPostCommand(id), default)).IsSuccess.Should().BeTrue();

        (await List(db, Bhaskar)).Should().BeEmpty();
        (await new GetMarketPostHandler(db, As(Bhaskar)).Handle(new GetMarketPostQuery(id), default)).Error!.Code.Should().Be("MARKET.NOT_FOUND");
        (await new AddMarketReplyHandler(db, As(Chitra)).Handle(new AddMarketReplyCommand(id, "Hi"), default)).Error!.Code.Should().Be("MARKET.NOT_FOUND");
    }

    [Fact] public async Task AnAdmin_CanRemoveAnyPost()
    {
        var db = NewDb();
        var id = await Post(db, Asha);
        (await new DeleteMarketPostHandler(db, As(Admin, admin: true)).Handle(new DeleteMarketPostCommand(id), default)).IsSuccess.Should().BeTrue();
        (await List(db, Asha)).Should().BeEmpty();
    }
}
