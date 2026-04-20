using MediatR;
using DigitalSocieties.Communication.Application.Commands;
using DigitalSocieties.Communication.Application.Queries;
using DigitalSocieties.Shared.Contracts;
using Microsoft.AspNetCore.Mvc;

namespace DigitalSocieties.Api.Endpoints.Notice;

/// <summary>
/// Notice / announcement endpoints.
/// Admins post notices (Emergency type also sends SMS via MSG91).
/// Residents receive real-time push via SignalR + can browse history.
/// </summary>
public static class NoticeEndpoints
{
    public static RouteGroupBuilder MapNoticeEndpoints(this RouteGroupBuilder group)
    {
        // ── Admin: post a notice / announcement ───────────────────────────────
        // POST /api/v1/notices
        // Body: { "societyId":"...", "title":"...", "body":"...",
        //         "type":"Notice|Emergency|Event|Circular",
        //         "isPinned": false, "expiresAt": "2026-05-01T00:00:00Z" }
        // Emergency type → additional SMS blast to all residents via MSG91
        group.MapPost("/", async (
            PostNoticeCommand cmd,
            IMediator mediator,
            CancellationToken ct) =>
        {
            var result = await mediator.Send(cmd, ct);
            return result.IsSuccess
                ? Results.Created($"/api/v1/notices/{result.Value}", new { noticeId = result.Value })
                : Results.BadRequest(result.Error);
        })
        .RequireAuthorization("AdminOnly")
        .WithName("PostNotice")
        .WithSummary("Post a notice to the society — Emergency type also triggers SMS blast")
        .WithTags("Notice");

        // ── Admin: pin/unpin a notice ──────────────────────────────────────────
        // PUT /api/v1/notices/{noticeId}/pin
        group.MapPut("/{noticeId:guid}/pin", async (
            Guid noticeId,
            [FromBody] PinNoticeRequest body,
            IMediator mediator,
            CancellationToken ct) =>
        {
            var cmd = new PinNoticeCommand(noticeId, body.IsPinned);
            var result = await mediator.Send(cmd, ct);
            return result.IsSuccess ? Results.Ok() : Results.BadRequest(result.Error);
        })
        .RequireAuthorization("AdminOnly")
        .WithName("PinNotice")
        .WithSummary("Pin or unpin a notice (pinned notices appear at the top of the feed)")
        .WithTags("Notice");

        // ── Admin: expire (soft-delete) a notice ──────────────────────────────
        // DELETE /api/v1/notices/{noticeId}
        group.MapDelete("/{noticeId:guid}", async (
            Guid noticeId,
            IMediator mediator,
            CancellationToken ct) =>
        {
            var cmd = new ExpireNoticeCommand(noticeId);
            var result = await mediator.Send(cmd, ct);
            return result.IsSuccess ? Results.NoContent() : Results.BadRequest(result.Error);
        })
        .RequireAuthorization("AdminOnly")
        .WithName("ExpireNotice")
        .WithSummary("Expire (soft-delete) a notice — it disappears from the resident feed")
        .WithTags("Notice");

        // ── Shared: list active notices for a society ─────────────────────────
        // GET /api/v1/notices?page=1&pageSize=20&type=Emergency
        group.MapGet("/", async (
            [FromQuery] string? type,
            [FromQuery] int page,
            [FromQuery] int pageSize,
            IMediator mediator,
            ICurrentUser currentUser,
            CancellationToken ct) =>
        {
            var query = new GetSocietyNoticesQuery(
                currentUser.SocietyId!.Value,
                type,
                page <= 0 ? 1 : page,
                pageSize is <= 0 or > 100 ? 20 : pageSize);
            var result = await mediator.Send(query, ct);
            return result.IsSuccess ? Results.Ok(result.Value) : Results.BadRequest(result.Error);
        })
        .RequireAuthorization()
        .WithName("GetSocietyNotices")
        .WithSummary("List active notices — pinned notices appear first, Emergency notices highlighted")
        .WithTags("Notice");

        // ── Shared: get single notice ──────────────────────────────────────────
        // GET /api/v1/notices/{noticeId}
        group.MapGet("/{noticeId:guid}", async (
            Guid noticeId,
            IMediator mediator,
            CancellationToken ct) =>
        {
            var query = new GetNoticeDetailQuery(noticeId);
            var result = await mediator.Send(query, ct);
            return result.IsSuccess ? Results.Ok(result.Value) : Results.NotFound(result.Error);
        })
        .RequireAuthorization()
        .WithName("GetNoticeDetail")
        .WithSummary("Get full detail of a single notice")
        .WithTags("Notice");

        return group;
    }

    public record PinNoticeRequest(bool IsPinned);
}
