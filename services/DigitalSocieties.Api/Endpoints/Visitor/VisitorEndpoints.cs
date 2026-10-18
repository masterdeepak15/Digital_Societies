using MediatR;
using DigitalSocieties.Visitor.Application.Commands;
using DigitalSocieties.Visitor.Application.Queries;
using DigitalSocieties.Shared.Contracts;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using System.Text.Json.Nodes;
using DigitalSocieties.Billing.Application.Commands;

namespace DigitalSocieties.Api.Endpoints.Visitor;

/// <summary>
/// Visitor gate management endpoints.
/// Guard adds visitors (offline-friendly via mobile SQLite sync).
/// Resident approves/rejects — notified in real-time via SignalR.
/// QR tokens are signed JWTs valid for 2 minutes (single-use nonce).
/// </summary>
public static class VisitorEndpoints
{
    public static RouteGroupBuilder MapVisitorEndpoints(this RouteGroupBuilder group)
    {
        // ── Guard: log a new visitor at the gate ───────────────────────────────
        // POST /api/v1/visitors
        // Body: { "societyId":"...", "flatId":"...", "visitorName":"...",
        //         "visitorPhone":"...", "purpose":"Guest", "vehicleNumber":"MH12AB1234" }
        group.MapPost("/", async (
            AddVisitorCommand body,
            IMediator mediator,
            ICurrentUser currentUser,
            IFlatQueryService flats,
            CancellationToken ct) =>
        {
            if (currentUser.SocietyId is null) return Results.BadRequest("Society context required.");
            // The society comes from the session, and the flat must belong to it.
            var labels = await flats.GetFlatLabelsAsync(currentUser.SocietyId.Value, ct);
            if (!labels.ContainsKey(body.FlatId)) return Results.BadRequest("Unknown flat for this society.");
            var cmd = body with { SocietyId = currentUser.SocietyId.Value };
            var result = await mediator.Send(cmd, ct);
            return result.IsSuccess
                ? Results.Created($"/api/v1/visitors/{result.Value!.VisitorId}", new { visitorId = result.Value.VisitorId })
                : Results.BadRequest(result.Error);
        })
        .RequireAuthorization("GuardOrAdmin")
        .WithName("AddVisitor")
        .WithSummary("Log a visitor at the gate — triggers real-time approval notification to resident")
        .WithTags("Visitor");

        // ── Guard: has this person been here before? (by mobile number) ───────────
        // GET /api/v1/visitors/lookup?phone=+919876543210
        group.MapGet("/lookup", async (
            [FromQuery] string? phone,
            IMediator mediator,
            ICurrentUser currentUser,
            IFlatQueryService flats,
            CancellationToken ct) =>
        {
            if (currentUser.SocietyId is null) return Results.BadRequest("Society context required.");
            var result = await mediator.Send(new LookupVisitorQuery(currentUser.SocietyId.Value, phone ?? ""), ct);
            if (!result.IsSuccess) return Results.BadRequest(result.Error);
            var h = result.Value!;
            var labels = await flats.GetFlatLabelsAsync(currentUser.SocietyId.Value, ct);
            return Results.Ok(new
            {
                h.Found, h.Name, h.VisitCount, h.LastVisitAt, h.LastFlatId,
                LastFlat = h.LastFlatId is { } f ? labels.GetValueOrDefault(f) : null,
                h.LastPurpose, h.VehicleNumber, h.VehicleType, h.PhotoMediaId, h.IdType, h.IdLast4, h.Companions,
            });
        })
        .RequireAuthorization("GuardOrAdmin")
        .WithName("LookupVisitor")
        .WithTags("Visitor");

        // ── Resident: approve a pending visitor ───────────────────────────────
        // POST /api/v1/visitors/{visitorId}/approve
        group.MapPost("/{visitorId:guid}/approve", async (
            Guid visitorId,
            IMediator mediator,
            ICurrentUser currentUser,
            CancellationToken ct) =>
        {
            var cmd = new ApproveVisitorCommand(visitorId);
            var result = await mediator.Send(cmd, ct);
            return result.IsSuccess
                ? Results.Ok(new { qrToken = result.Value })  // QR token → guard scans to allow entry
                : Results.BadRequest(result.Error);
        })
        .RequireAuthorization("ResidentOrAdmin")
        .WithName("ApproveVisitor")
        .WithSummary("Approve a pending visitor — returns signed QR token (2-min TTL) for gate scanning")
        .WithTags("Visitor");

        // ── Resident: reject a pending visitor ────────────────────────────────
        // POST /api/v1/visitors/{visitorId}/reject
        group.MapPost("/{visitorId:guid}/reject", async (
            Guid visitorId,
            [FromBody] RejectVisitorRequest body,
            IMediator mediator,
            ICurrentUser currentUser,
            CancellationToken ct) =>
        {
            var cmd = new RejectVisitorCommand(visitorId, currentUser.UserId!.Value, body.Reason);
            var result = await mediator.Send(cmd, ct);
            return result.IsSuccess
                ? Results.Ok()
                : Results.BadRequest(result.Error);
        })
        .RequireAuthorization("ResidentOrAdmin")
        .WithName("RejectVisitor")
        .WithSummary("Reject a pending visitor — notifies guard via SignalR")
        .WithTags("Visitor");

        // ── Guard: scan QR and mark visitor as entered ─────────────────────────
        // POST /api/v1/visitors/enter
        // Body: { "qrToken": "<signed-jwt>" }
        group.MapPost("/enter", async (
            [FromBody] EnterVisitorRequest body,
            IMediator mediator,
            CancellationToken ct) =>
        {
            var cmd = new MarkVisitorEnteredCommand(body.QrToken);
            var result = await mediator.Send(cmd, ct);
            return result.IsSuccess
                ? Results.Ok(new { visitorId = result.Value })
                : Results.BadRequest(result.Error);
        })
        .RequireAuthorization("GuardOrAdmin")
        .WithName("MarkVisitorEntered")
        .WithSummary("Scan resident-approved QR token to record physical entry (validates 2-min TTL + nonce)")
        .WithTags("Visitor");

        // ── Guard: mark visitor as exited ─────────────────────────────────────
        // POST /api/v1/visitors/{visitorId}/exit
        group.MapPost("/{visitorId:guid}/exit", async (
            Guid visitorId,
            IMediator mediator,
            CancellationToken ct) =>
        {
            var cmd = new MarkVisitorExitedCommand(visitorId);
            var result = await mediator.Send(cmd, ct);
            return result.IsSuccess
                ? Results.Ok()
                : Results.BadRequest(result.Error);
        })
        .RequireAuthorization("GuardOrAdmin")
        .WithName("MarkVisitorExited")
        .WithSummary("Record visitor exit — closes the gate log entry")
        .WithTags("Visitor");

        // ── Shared: list visitors for a flat (resident) or society (admin/guard) ──
        // GET /api/v1/visitors?flatId=...&status=Pending&page=1&pageSize=20
        group.MapGet("/", async (
            [FromQuery] Guid? flatId,
            [FromQuery] string? status,
            IMediator mediator,
            ICurrentUser currentUser,
            IFlatQueryService flats,
            CancellationToken ct,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20) =>
        {
            // Only gate staff and admins may look at another flat's visitors; everyone else sees their own flat.
            var seesAllFlats = currentUser.IsInRole("admin") || currentUser.IsInRole("guard");
            if (!seesAllFlats && currentUser.FlatId is null)
                return Results.Json(new { items = Array.Empty<object>(), totalCount = 0, page, pageSize });
            var effectiveFlatId = seesAllFlats ? (flatId ?? currentUser.FlatId) : currentUser.FlatId;
            var query = new GetVisitorsQuery(
                currentUser.SocietyId!.Value,
                effectiveFlatId,
                status,
                page <= 0 ? 1 : page,
                pageSize is <= 0 or > 100 ? 20 : pageSize);
            var result = await mediator.Send(query, ct);
            if (!result.IsSuccess) return Results.BadRequest(result.Error);

            // Add the host flat label ("A-101") so the console can show where the visitor is going.
            var node = JsonSerializer.SerializeToNode(result.Value, new JsonSerializerOptions(JsonSerializerDefaults.Web));
            if (node?["items"] is JsonArray items)
            {
                var labels = await flats.GetFlatLabelsAsync(currentUser.SocietyId!.Value, ct);
                foreach (var item in items.OfType<JsonObject>())
                    if (Guid.TryParse(item["flatId"]?.GetValue<string>(), out var fid) && labels.TryGetValue(fid, out var label))
                        item["hostFlatDisplay"] = label;
            }
            return Results.Json(node);
        })
        .RequireAuthorization()
        .WithName("GetVisitors")
        .WithSummary("List visitors — residents see their flat's visitors; admins/guards see all")
        .WithTags("Visitor");

        return group;
    }

    // ── Request DTOs (minimal, validated by FluentValidation in command handlers) ──
    public record RejectVisitorRequest(string? Reason);
    public record EnterVisitorRequest(string QrToken);
}
