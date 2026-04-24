using MediatR;
using Microsoft.AspNetCore.Mvc;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Social.Application.Commands;
using DigitalSocieties.Social.Application.Queries;

namespace DigitalSocieties.Api.Endpoints.Social;

/// <summary>
/// Private Social Network endpoints — Society Feed, Groups, Marketplace, Polls, Directory.
/// All routes require a verified society member JWT.
/// Emergency Wall posts are admin-only (enforced in CreatePostCommandHandler).
/// </summary>
public static class SocialEndpoints
{
    public static RouteGroupBuilder MapSocialEndpoints(this RouteGroupBuilder group)
    {
        // ── Feed: list posts ──────────────────────────────────────────────────
        // GET /api/v1/social/posts?groupId=...&category=...&page=1&pageSize=20
        group.MapGet("/posts", async (
            [FromQuery] Guid? groupId,
            [FromQuery] string? category,
            [FromQuery] int page,
            [FromQuery] int pageSize,
            IMediator mediator,
            ICurrentUser currentUser,
            CancellationToken ct) =>
        {
            var query = new GetFeedQuery(
                currentUser.SocietyId!.Value,
                groupId,
                category,
                page <= 0 ? 1 : page,
                pageSize is <= 0 or > 50 ? 20 : pageSize);
            var result = await mediator.Send(query, ct);
            return result.IsSuccess ? Results.Ok(result.Value) : Results.BadRequest(result.Error);
        })
        .RequireAuthorization()
        .WithName("GetFeed")
        .WithSummary("Get the society feed — pinned posts first, then newest. Filter by group or category.")
        .WithTags("Social");

        // ── Feed: get single post with comments + reactions ───────────────────
        // GET /api/v1/social/posts/{postId}
        group.MapGet("/posts/{postId:guid}", async (
            Guid postId,
            IMediator mediator,
            ICurrentUser currentUser,
            CancellationToken ct) =>
        {
            var query = new GetPostDetailQuery(postId, currentUser.UserId!.Value);
            var result = await mediator.Send(query, ct);
            return result.IsSuccess ? Results.Ok(result.Value) : Results.NotFound(result.Error);
        })
        .RequireAuthorization()
        .WithName("GetPostDetail")
        .WithSummary("Full post detail with comments, reactions, poll results, and marketplace info.")
        .WithTags("Social");

        // ── Feed: create post ─────────────────────────────────────────────────
        // POST /api/v1/social/posts
        group.MapPost("/posts", async (
            CreatePostCommand cmd,
            IMediator mediator,
            CancellationToken ct) =>
        {
            var result = await mediator.Send(cmd, ct);
            return result.IsSuccess
                ? Results.Created($"/api/v1/social/posts/{result.Value.PostId}", result.Value)
                : Results.BadRequest(result.Error);
        })
        .RequireAuthorization()
        .WithName("CreatePost")
        .WithSummary("Create a post (text + photos). Category 'emergency' is admin-only.")
        .WithTags("Social");

        // ── Feed: get pre-signed URL to upload post image ─────────────────────
        // POST /api/v1/social/posts/upload-url
        group.MapPost("/posts/upload-url", async (
            [FromBody] GetPostUploadUrlRequest body,
            DigitalSocieties.Shared.Contracts.IStorageProvider storage,
            ICurrentUser currentUser,
            CancellationToken ct) =>
        {
            var ext = Path.GetExtension(body.FileName).ToLowerInvariant();
            if (ext is not (".jpg" or ".jpeg" or ".png" or ".webp"))
                return Results.BadRequest("Only .jpg, .png, .webp images are allowed.");

            var key = $"social/{currentUser.SocietyId}/{currentUser.UserId}/{Guid.NewGuid()}{ext}";
            var url = await storage.GetPresignedUrlAsync(key, TimeSpan.FromSeconds(900), ct);
            return Results.Ok(new { uploadUrl = url, objectKey = key });
        })
        .RequireAuthorization()
        .WithName("GetPostUploadUrl")
        .WithSummary("Get a pre-signed MinIO PUT URL for uploading a post photo (expires 15 min).")
        .WithTags("Social");

        // ── Feed: delete post ─────────────────────────────────────────────────
        // DELETE /api/v1/social/posts/{postId}
        group.MapDelete("/posts/{postId:guid}", async (
            Guid postId,
            IMediator mediator,
            ICurrentUser currentUser,
            CancellationToken ct) =>
        {
            var cmd = new DeletePostCommand(postId, currentUser.UserId!.Value, currentUser.IsInRole("admin"));
            var result = await mediator.Send(cmd, ct);
            return result.IsSuccess ? Results.NoContent() : Results.BadRequest(result.Error);
        })
        .RequireAuthorization()
        .WithName("DeletePost")
        .WithSummary("Soft-delete a post (own post or admin can delete any).")
        .WithTags("Social");

        // ── Feed: admin pin/unpin ─────────────────────────────────────────────
        // PUT /api/v1/social/posts/{postId}/pin
        group.MapPut("/posts/{postId:guid}/pin", async (
            Guid postId,
            [FromBody] PinPostRequest body,
            IMediator mediator,
            CancellationToken ct) =>
        {
            var result = await mediator.Send(new PinPostCommand(postId, body.IsPinned), ct);
            return result.IsSuccess ? Results.Ok() : Results.BadRequest(result.Error);
        })
        .RequireAuthorization("AdminOnly")
        .WithName("PinPost")
        .WithSummary("Admin: pin or unpin a post (pinned posts appear at top of feed).")
        .WithTags("Social");

        // ── Feed: admin lock/unlock comments ──────────────────────────────────
        // PUT /api/v1/social/posts/{postId}/lock
        group.MapPut("/posts/{postId:guid}/lock", async (
            Guid postId,
            [FromBody] LockPostRequest body,
            IMediator mediator,
            CancellationToken ct) =>
        {
            var result = await mediator.Send(new LockPostCommentsCommand(postId, body.IsLocked), ct);
            return result.IsSuccess ? Results.Ok() : Results.BadRequest(result.Error);
        })
        .RequireAuthorization("AdminOnly")
        .WithName("LockPostComments")
        .WithSummary("Admin: lock (disable) or unlock comments on a post.")
        .WithTags("Social");

        // ── Reactions ─────────────────────────────────────────────────────────
        // POST /api/v1/social/posts/{postId}/react
        group.MapPost("/posts/{postId:guid}/react", async (
            Guid postId,
            [FromBody] ReactRequest body,
            IMediator mediator,
            ICurrentUser currentUser,
            CancellationToken ct) =>
        {
            var result = await mediator.Send(
                new ReactToPostCommand(postId, currentUser.UserId!.Value, body.Type), ct);
            return result.IsSuccess ? Results.Ok() : Results.BadRequest(result.Error);
        })
        .RequireAuthorization()
        .WithName("ReactToPost")
        .WithSummary("Add or change a reaction (helpful / thanks / thumbsup). Upsert — replaces existing.")
        .WithTags("Social");

        // DELETE /api/v1/social/posts/{postId}/react
        group.MapDelete("/posts/{postId:guid}/react", async (
            Guid postId,
            IMediator mediator,
            ICurrentUser currentUser,
            CancellationToken ct) =>
        {
            var result = await mediator.Send(
                new RemoveReactionCommand(postId, currentUser.UserId!.Value), ct);
            return result.IsSuccess ? Results.NoContent() : Results.BadRequest(result.Error);
        })
        .RequireAuthorization()
        .WithName("RemoveReaction")
        .WithTags("Social");

        // ── Comments ──────────────────────────────────────────────────────────
        // POST /api/v1/social/posts/{postId}/comments
        group.MapPost("/posts/{postId:guid}/comments", async (
            Guid postId,
            [FromBody] CommentRequest body,
            IMediator mediator,
            ICurrentUser currentUser,
            CancellationToken ct) =>
        {
            var cmd = new CommentOnPostCommand(
                postId, currentUser.UserId!.Value, currentUser.FlatId!.Value,
                body.Body, body.ParentCommentId);
            var result = await mediator.Send(cmd, ct);
            return result.IsSuccess
                ? Results.Created($"/api/v1/social/posts/{postId}", new { commentId = result.Value })
                : Results.BadRequest(result.Error);
        })
        .RequireAuthorization()
        .WithName("CommentOnPost")
        .WithSummary("Add a comment or reply (max one level deep) to a post.")
        .WithTags("Social");

        // DELETE /api/v1/social/posts/{postId}/comments/{commentId}
        group.MapDelete("/posts/{postId:guid}/comments/{commentId:guid}", async (
            Guid commentId,
            IMediator mediator,
            ICurrentUser currentUser,
            CancellationToken ct) =>
        {
            var cmd = new DeleteCommentCommand(
                commentId, currentUser.UserId!.Value, currentUser.IsInRole("admin"));
            var result = await mediator.Send(cmd, ct);
            return result.IsSuccess ? Results.NoContent() : Results.BadRequest(result.Error);
        })
        .RequireAuthorization()
        .WithName("DeleteComment")
        .WithTags("Social");

        // ── Report post ───────────────────────────────────────────────────────
        // POST /api/v1/social/posts/{postId}/report
        group.MapPost("/posts/{postId:guid}/report", async (
            Guid postId,
            [FromBody] ReportRequest body,
            IMediator mediator,
            ICurrentUser currentUser,
            CancellationToken ct) =>
        {
            var result = await mediator.Send(
                new ReportPostCommand(postId, currentUser.UserId!.Value, body.Reason), ct);
            return result.IsSuccess ? Results.Ok() : Results.BadRequest(result.Error);
        })
        .RequireAuthorization()
        .WithName("ReportPost")
        .WithSummary("Flag a post for admin review.")
        .WithTags("Social");

        // ── Poll vote ─────────────────────────────────────────────────────────
        // POST /api/v1/social/polls/{pollId}/vote
        group.MapPost("/polls/{pollId:guid}/vote", async (
            Guid pollId,
            [FromBody] VoteRequest body,
            IMediator mediator,
            ICurrentUser currentUser,
            CancellationToken ct) =>
        {
            var result = await mediator.Send(
                new VotePollCommand(pollId, currentUser.UserId!.Value, body.OptionIds), ct);
            return result.IsSuccess ? Results.Ok() : Results.BadRequest(result.Error);
        })
        .RequireAuthorization()
        .WithName("VotePoll")
        .WithSummary("Cast vote on a poll. One vote per user; replaces existing vote.")
        .WithTags("Social");

        // ── Directory ─────────────────────────────────────────────────────────
        // GET /api/v1/social/directory
        group.MapGet("/directory", async (
            [FromQuery] string? search,
            IMediator mediator,
            ICurrentUser currentUser,
            CancellationToken ct) =>
        {
            var result = await mediator.Send(
                new GetDirectoryQuery(currentUser.SocietyId!.Value, search), ct);
            return result.IsSuccess ? Results.Ok(result.Value) : Results.BadRequest(result.Error);
        })
        .RequireAuthorization()
        .WithName("GetDirectory")
        .WithSummary("Get opted-in resident directory. Hidden entries and non-opted-in residents excluded.")
        .WithTags("Social");

        // PUT /api/v1/social/directory/me
        group.MapPut("/directory/me", async (
            [FromBody] UpdateDirectoryRequest body,
            IMediator mediator,
            ICurrentUser currentUser,
            CancellationToken ct) =>
        {
            var cmd = new UpsertDirectoryEntryCommand(
                currentUser.UserId!.Value, currentUser.SocietyId!.Value,
                body.DisplayName, body.ShowPhone, body.ShowEmail, body.Bio);
            var result = await mediator.Send(cmd, ct);
            return result.IsSuccess ? Results.Ok() : Results.BadRequest(result.Error);
        })
        .RequireAuthorization()
        .WithName("UpdateDirectoryEntry")
        .WithSummary("Opt in to or update your resident directory entry.")
        .WithTags("Social");

        return group;
    }

    // ── Request DTOs ──────────────────────────────────────────────────────────
    public record PinPostRequest(bool IsPinned);
    public record LockPostRequest(bool IsLocked);
    public record ReactRequest(string Type);
    public record CommentRequest(string Body, Guid? ParentCommentId);
    public record ReportRequest(string? Reason);
    public record VoteRequest(List<Guid> OptionIds);
    public record GetPostUploadUrlRequest(string FileName);
    public record UpdateDirectoryRequest(
        string DisplayName, bool ShowPhone, bool ShowEmail, string? Bio);
}
