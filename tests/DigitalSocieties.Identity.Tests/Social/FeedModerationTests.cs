using Xunit;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Social.Application.Commands;
using DigitalSocieties.Social.Application.Queries;
using DigitalSocieties.Social.Domain.Entities;
using DigitalSocieties.Social.Infrastructure.Persistence;

namespace DigitalSocieties.Identity.Tests.Social;

public class FeedModerationTests
{
    private static readonly Guid Society = Guid.NewGuid();
    private static readonly Guid Author = Guid.NewGuid();
    private static readonly Guid Other = Guid.NewGuid();

    private static (SocialDbContext db, SocialPost post) Seed()
    {
        var db = new SocialDbContext(new DbContextOptionsBuilder<SocialDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var post = SocialPost.Create(Society, Author, Guid.NewGuid(), "general", "Hello neighbours").Value!;
        db.Posts.Add(post);
        db.SaveChanges();
        return (db, post);
    }

    // ── comments: the author or an admin ────────────────────────────────────────
    [Fact] public async Task Author_CanCloseComments_OnTheirOwnPost()
    {
        var (db, post) = Seed();
        var r = await new LockPostCommentsCommandHandler(db).Handle(new LockPostCommentsCommand(post.Id, true, Author, IsAdmin: false), default);
        r.IsSuccess.Should().BeTrue();
        (await db.Posts.SingleAsync()).IsLocked.Should().BeTrue();
    }

    [Fact] public async Task SomeoneElse_CannotCloseComments()
    {
        var (db, post) = Seed();
        var r = await new LockPostCommentsCommandHandler(db).Handle(new LockPostCommentsCommand(post.Id, true, Other, IsAdmin: false), default);
        r.IsSuccess.Should().BeFalse();
        (await db.Posts.SingleAsync()).IsLocked.Should().BeFalse();
    }

    [Fact] public async Task Admin_CanCloseComments_OnAnyPost()
    {
        var (db, post) = Seed();
        var r = await new LockPostCommentsCommandHandler(db).Handle(new LockPostCommentsCommand(post.Id, true, Other, IsAdmin: true), default);
        r.IsSuccess.Should().BeTrue();
    }

    // ── hiding ──────────────────────────────────────────────────────────────────
    [Fact] public async Task HiddenPost_IsOnlySeenByAdminsAndItsAuthor()
    {
        var (db, post) = Seed();
        await new HidePostCommandHandler(db).Handle(new HidePostCommand(post.Id, true), default);
        var feed = new GetFeedQueryHandler(db);

        (await feed.Handle(new GetFeedQuery(Society, null, null, 1, 20, Other, false), default)).Value!.Items.Should().BeEmpty();
        (await feed.Handle(new GetFeedQuery(Society, null, null, 1, 20, Author, false), default)).Value!.Items.Should().HaveCount(1);
        (await feed.Handle(new GetFeedQuery(Society, null, null, 1, 20, Other, true), default)).Value!.Items.Should().HaveCount(1);
    }

    [Fact] public async Task Unhide_BringsThePostBackForEveryone()
    {
        var (db, post) = Seed();
        await new HidePostCommandHandler(db).Handle(new HidePostCommand(post.Id, true), default);
        await new HidePostCommandHandler(db).Handle(new HidePostCommand(post.Id, false), default);
        (await new GetFeedQueryHandler(db).Handle(new GetFeedQuery(Society, null, null, 1, 20, Other, false), default)).Value!.Items.Should().HaveCount(1);
    }

    [Fact] public async Task Feed_ReportsWhetherTheViewerLikedAPost()
    {
        var (db, post) = Seed();
        db.Reactions.Add(PostReaction.Create(post.Id, Other, "thumbsup").Value!);
        await db.SaveChangesAsync();
        var feed = new GetFeedQueryHandler(db);

        (await feed.Handle(new GetFeedQuery(Society, null, null, 1, 20, Other, false), default)).Value!.Items.Single().LikedByMe.Should().BeTrue();
        (await feed.Handle(new GetFeedQuery(Society, null, null, 1, 20, Author, false), default)).Value!.Items.Single().LikedByMe.Should().BeFalse();
    }
}
