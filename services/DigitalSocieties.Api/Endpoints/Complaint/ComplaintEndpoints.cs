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
            DigitalSocieties.Complaint.Infrastructure.Persistence.ComplaintDbContext db,
            CancellationToken ct) =>
        {
            // Same society only; admins and staff may move a complaint anywhere, the resident who raised it
            // may only reopen or close it.
            var owner = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(
                db.Complaints.Where(c => c.Id == complaintId && c.SocietyId == currentUser.SocietyId), ct);
            if (owner is null) return Results.NotFound();
            var staff = currentUser.IsInRole("admin") || currentUser.IsInRole("staff");
            var ownerMayDo = owner.RaisedBy == currentUser.UserId
                && (string.Equals(body.Status, "Reopened", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(body.Status, "Closed", StringComparison.OrdinalIgnoreCase));
            if (!staff && !ownerMayDo) return Results.Forbid();

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
            IMediator mediator,
            ICurrentUser currentUser,
            CancellationToken ct,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20) =>
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
            IMediator mediator,
            ICurrentUser currentUser,
            CancellationToken ct,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20) =>
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
            ICurrentUser currentUser,
            DigitalSocieties.Complaint.Infrastructure.Persistence.ComplaintDbContext db,
            CancellationToken ct) =>
        {
            // Admins and staff see every complaint in their society; a resident only their own flat's.
            var row = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(
                db.Complaints.Where(c => c.Id == complaintId && c.SocietyId == currentUser.SocietyId), ct);
            var staff = currentUser.IsInRole("admin") || currentUser.IsInRole("staff");
            if (row is null || (!staff && row.FlatId != currentUser.FlatId && row.RaisedBy != currentUser.UserId)) return Results.NotFound();

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
