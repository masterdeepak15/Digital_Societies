using MediatR;
using DigitalSocieties.Complaint.Application.Commands;
using DigitalSocieties.Complaint.Application.Queries;
using DigitalSocieties.Shared.Contracts;
using Microsoft.AspNetCore.Mvc;

namespace DigitalSocieties.Api.Endpoints.Complaint;

/// <summary>
/// Complaint ticket endpoints.
/// Residents raise complaints (with photos via pre-signed MinIO URLs).
/// Admins assign, update status. Both sides get real-time SignalR updates.
/// </summary>
public static class ComplaintEndpoints
{
    public static RouteGroupBuilder MapComplaintEndpoints(this RouteGroupBuilder group)
    {
        // ── Resident: raise a new complaint ───────────────────────────────────
        // POST /api/v1/complaints
        // Body: { "societyId":"...", "flatId":"...", "title":"...",
        //         "description":"...", "category":"Plumbing", "priority":"Medium" }
        group.MapPost("/", async (
            RaiseComplaintCommand cmd,
            IMediator mediator,
            CancellationToken ct) =>
        {
            var result = await mediator.Send(cmd, ct);
            return result.IsSuccess
                ? Results.Created($"/api/v1/complaints/{result.Value.ComplaintId}",
                    new { complaintId = result.Value.ComplaintId, ticketNumber = result.Value.TicketNumber })
                : Results.BadRequest(result.Error);
        })
        .RequireAuthorization("ResidentOrAdmin")
        .WithName("RaiseComplaint")
        .WithSummary("Raise a new complaint ticket — returns ticket number (C-YYYY-XXXX format)")
        .WithTags("Complaint");

        // ── Resident/Admin: get a pre-signed URL to upload a complaint photo ──
        // POST /api/v1/complaints/{complaintId}/upload-url
        // Body: { "fileName": "crack.jpg" }
        // Client then PUT's directly to MinIO — no file passes through API server
        group.MapPost("/{complaintId:guid}/upload-url", async (
            Guid complaintId,
            [FromBody] GetUploadUrlRequest body,
            IMediator mediator,
            CancellationToken ct) =>
        {
            var cmd = new GetComplaintUploadUrlCommand(body.FileName, "image/jpeg");
            var result = await mediator.Send(cmd, ct);
            return result.IsSuccess
                ? Results.Ok(new { uploadUrl = result.Value.UploadUrl, objectKey = result.Value.ObjectKey })
                : Results.BadRequest(result.Error);
        })
        .RequireAuthorization("ResidentOrAdmin")
        .WithName("GetComplaintUploadUrl")
        .WithSummary("Get a pre-signed MinIO PUT URL so client uploads photo directly (expires in 15 min)")
        .WithTags("Complaint");

        // ── Admin: assign complaint to a staff member ─────────────────────────
        // POST /api/v1/complaints/{complaintId}/assign
        // Body: { "assigneeId": "...", "note": "..." }
        group.MapPost("/{complaintId:guid}/assign", async (
            Guid complaintId,
            [FromBody] AssignComplaintRequest body,
            IMediator mediator,
            ICurrentUser currentUser,
            CancellationToken ct) =>
        {
            var cmd = new AssignComplaintCommand(complaintId, body.AssigneeId, body.Note, currentUser.UserId!.Value);
            var result = await mediator.Send(cmd, ct);
            return result.IsSuccess ? Results.Ok() : Results.BadRequest(result.Error);
        })
        .RequireAuthorization("AdminOnly")
        .WithName("AssignComplaint")
        .WithSummary("Assign a complaint to a staff member")
        .WithTags("Complaint");

        // ── Staff/Admin: update complaint status ──────────────────────────────
        // PUT /api/v1/complaints/{complaintId}/status
        // Body: { "status": "InProgress", "note": "Started work" }
        group.MapPut("/{complaintId:guid}/status", async (
            Guid complaintId,
            [FromBody] UpdateComplaintStatusRequest body,
            IMediator mediator,
            ICurrentUser currentUser,
            CancellationToken ct) =>
        {
            var cmd = new UpdateComplaintStatusCommand(
                complaintId, body.Status, body.Note, currentUser.UserId!.Value);
            var result = await mediator.Send(cmd, ct);
            return result.IsSuccess ? Results.Ok() : Results.BadRequest(result.Error);
        })
        .RequireAuthorization()
        .WithName("UpdateComplaintStatus")
        .WithSummary("Update complaint status (InProgress / Resolved / Closed / Reopened)")
        .WithTags("Complaint");

        // ── Resident: list my complaints ──────────────────────────────────────
        // GET /api/v1/complaints/my?status=Open&page=1&pageSize=20
        group.MapGet("/my", async (
            [FromQuery] string? status,
            [FromQuery] int page,
            [FromQuery] int pageSize,
            IMediator mediator,
            ICurrentUser currentUser,
            CancellationToken ct) =>
        {
            var query = new GetMyComplaintsQuery(
                currentUser.UserId!.Value,
                status,
                page <= 0 ? 1 : page,
                pageSize is <= 0 or > 100 ? 20 : pageSize);
            var result = await mediator.Send(query, ct);
            return result.IsSuccess ? Results.Ok(result.Value) : Results.BadRequest(result.Error);
        })
        .RequireAuthorization("ResidentOrAdmin")
        .WithName("GetMyComplaints")
        .WithSummary("Get the authenticated resident's complaint tickets")
        .WithTags("Complaint");

        // ── Admin: list all society complaints ────────────────────────────────
        // GET /api/v1/complaints?status=Open&category=Plumbing&page=1&pageSize=20
        group.MapGet("/", async (
            [FromQuery] string? status,
            [FromQuery] string? category,
            [FromQuery] int page,
            [FromQuery] int pageSize,
            IMediator mediator,
            ICurrentUser currentUser,
            CancellationToken ct) =>
        {
            var query = new GetSocietyComplaintsQuery(
                currentUser.SocietyId!.Value,
                status,
                category,
                page <= 0 ? 1 : page,
                pageSize is <= 0 or > 100 ? 20 : pageSize);
            var result = await mediator.Send(query, ct);
            return result.IsSuccess ? Results.Ok(result.Value) : Results.BadRequest(result.Error);
        })
        .RequireAuthorization("AdminOnly")
        .WithName("GetSocietyComplaints")
        .WithSummary("Admin: list all complaints for the society with filters")
        .WithTags("Complaint");

        // ── Shared: get single complaint detail ───────────────────────────────
        // GET /api/v1/complaints/{complaintId}
        group.MapGet("/{complaintId:guid}", async (
            Guid complaintId,
            IMediator mediator,
            CancellationToken ct) =>
        {
            var query = new GetComplaintDetailQuery(complaintId);
            var result = await mediator.Send(query, ct);
            return result.IsSuccess ? Results.Ok(result.Value) : Results.NotFound(result.Error);
        })
        .RequireAuthorization()
        .WithName("GetComplaintDetail")
        .WithSummary("Get full detail of a complaint including update timeline")
        .WithTags("Complaint");

        return group;
    }

    public record GetUploadUrlRequest(string FileName);
    public record AssignComplaintRequest(Guid AssigneeId, string? Note);
    public record UpdateComplaintStatusRequest(string Status, string? Note);
}
