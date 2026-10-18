using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Billing.Application.Commands;
using DigitalSocieties.Billing.Infrastructure.Persistence;
using DigitalSocieties.Communication.Infrastructure.Persistence;
using DigitalSocieties.Complaint.Infrastructure.Persistence;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Visitor.Infrastructure.Persistence;

namespace DigitalSocieties.Api.Endpoints.Sync;

/// <summary>
/// WatermelonDB sync protocol for the mobile app offline database.
/// Pull returns what changed since the device last synced (notices, bills, visitors and complaints the
/// caller may see); push accepts offline writes. The server stays the source of truth: only a guard's
/// offline visitors are applied, everything else a device sends is ignored.
/// </summary>
public static class SyncEndpoints
{
    private record Changes(List<Dictionary<string, object?>> Created,
                           List<Dictionary<string, object?>> Updated,
                           List<string> Deleted);

    private static long Ms(DateTimeOffset t) => t.ToUnixTimeMilliseconds();
    private static long? Ms(DateTimeOffset? t) => t?.ToUnixTimeMilliseconds();

    public static RouteGroupBuilder MapSyncEndpoints(this RouteGroupBuilder group)
    {
        // GET /api/v1/sync/pull?lastPulledAt=<epoch ms, empty on the first sync>
        group.MapGet("/pull", async (
            [FromQuery] long? lastPulledAt,
            CommunicationDbContext comms,
            BillingDbContext billing,
            VisitorDbContext visitors,
            ComplaintDbContext complaints,
            IFlatQueryService flats,
            ICurrentUser cu,
            CancellationToken ct) =>
        {
            if (cu.SocietyId is null || cu.UserId is null) return Results.Unauthorized();
            var society = cu.SocietyId.Value;
            var since   = DateTimeOffset.FromUnixTimeMilliseconds(lastPulledAt ?? 0);
            var now     = DateTimeOffset.UtcNow;
            var isAdmin = cu.IsInRole("admin");
            var isGuard = cu.IsInRole("guard");
            var ownFlat = cu.FlatId;
            var labels  = await flats.GetFlatLabelsAsync(society, ct);

            Changes Split<T>(List<T> rows, Func<T, DateTimeOffset> created, Func<T, bool> deleted,
                             Func<T, string> id, Func<T, Dictionary<string, object?>> map)
            {
                var c = new Changes([], [], []);
                foreach (var r in rows)
                {
                    if (deleted(r)) c.Deleted.Add(id(r));
                    else if (created(r) > since) c.Created.Add(map(r));
                    else c.Updated.Add(map(r));
                }
                return c;
            }

            // Notices: every notice of the society.
            var noticeRows = await comms.Notices.IgnoreQueryFilters()
                .Where(n => n.SocietyId == society && n.UpdatedAt > since)
                .ToListAsync(ct);
            var notices = Split(noticeRows, n => n.CreatedAt, n => n.IsDeleted, n => n.Id.ToString(), n => new()
            {
                ["id"] = n.Id.ToString(), ["server_id"] = n.Id.ToString(), ["title"] = n.Title, ["body"] = n.Body,
                ["type"] = n.Type.ToString(), ["is_read"] = false, ["posted_at"] = Ms(n.CreatedAt), ["expires_at"] = Ms(n.ExpiresAt),
            });

            // Bills and complaints: a resident gets their own flat's; admins and guards do not cache them.
            var billRows = ownFlat is null ? [] : await billing.Bills.IgnoreQueryFilters()
                .Where(b => b.SocietyId == society && b.FlatId == ownFlat && b.UpdatedAt > since).ToListAsync(ct);
            var bills = Split(billRows, b => b.CreatedAt, b => b.IsDeleted, b => b.Id.ToString(), b => new()
            {
                ["id"] = b.Id.ToString(), ["server_id"] = b.Id.ToString(), ["flat_id"] = b.FlatId.ToString(),
                ["society_id"] = b.SocietyId.ToString(), ["amount_paise"] = b.Amount.Paise, ["period"] = b.Period,
                ["status"] = b.Status.ToString().ToLowerInvariant(), ["description"] = b.Description,
                ["due_date"] = new DateTimeOffset(b.DueDate.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero).ToUnixTimeMilliseconds(),
                ["paid_at"] = Ms(b.PaidAt),
            });

            var complaintRows = ownFlat is null ? [] : await complaints.Complaints.IgnoreQueryFilters()
                .Where(c => c.SocietyId == society && c.FlatId == ownFlat && c.UpdatedAt > since).ToListAsync(ct);
            var complaintChanges = Split(complaintRows, c => c.CreatedAt, c => c.IsDeleted, c => c.Id.ToString(), c => new()
            {
                ["id"] = c.Id.ToString(), ["server_id"] = c.Id.ToString(), ["title"] = c.Title, ["description"] = c.Description,
                ["category"] = c.Category, ["status"] = c.Status.ToString(), ["priority"] = c.Priority.ToString(),
                ["flat_id"] = c.FlatId.ToString(), ["is_synced"] = true, ["created_at"] = Ms(c.CreatedAt), ["resolved_at"] = Ms(c.ResolvedAt),
            });

            // Visitors: guards and admins see the whole society, a resident their own flat.
            var visitorRows = await visitors.Visitors.IgnoreQueryFilters()
                .Where(v => v.SocietyId == society && v.UpdatedAt > since
                            && (isAdmin || isGuard || v.FlatId == ownFlat))
                .ToListAsync(ct);
            var visitorChanges = Split(visitorRows, v => v.CreatedAt, v => v.IsDeleted, v => v.Id.ToString(), v => new()
            {
                ["id"] = v.Id.ToString(), ["server_id"] = v.Id.ToString(), ["name"] = v.Name, ["phone"] = v.Phone ?? "",
                ["flat_number"] = labels.GetValueOrDefault(v.FlatId) ?? "", ["purpose"] = v.Purpose,
                ["status"] = v.Status.ToString().ToLowerInvariant(), ["vehicle_number"] = v.VehicleNumber, ["photo_url"] = v.PhotoUrl,
                ["is_synced"] = true, ["entry_time"] = Ms(v.EntryTime), ["exit_time"] = Ms(v.ExitTime), ["approved_at"] = Ms(v.ApprovedAt),
            });

            static object Wrap(Changes c) => new { created = c.Created, updated = c.Updated, deleted = c.Deleted };
            return Results.Json(new
            {
                changes = new
                {
                    notices = Wrap(notices), bills = Wrap(bills),
                    complaints = Wrap(complaintChanges), visitors = Wrap(visitorChanges),
                },
                timestamp = Ms(now),
            }, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        }).RequireAuthorization();

        // POST /api/v1/sync/push - offline writes. Only a guard's new visitors are applied.
        group.MapPost("/push", async (
            [FromBody] JsonElement body,
            MediatR.IMediator mediator,
            IFlatQueryService flats,
            ICurrentUser cu,
            CancellationToken ct) =>
        {
            if (cu.SocietyId is null) return Results.Unauthorized();
            var applied = 0;
            if ((cu.IsInRole("guard") || cu.IsInRole("admin"))
                && body.TryGetProperty("changes", out var changes) && changes.ValueKind == JsonValueKind.Object
                && changes.TryGetProperty("visitors", out var v) && v.TryGetProperty("created", out var created)
                && created.ValueKind == JsonValueKind.Array)
            {
                var labels = await flats.GetFlatLabelsAsync(cu.SocietyId.Value, ct);
                foreach (var rec in created.EnumerateArray())
                {
                    string? S(string k) => rec.TryGetProperty(k, out var x) && x.ValueKind == JsonValueKind.String ? x.GetString() : null;
                    var flatKey = S("flat_number")?.Trim();
                    var flat = labels.FirstOrDefault(l => string.Equals(l.Value, flatKey, StringComparison.OrdinalIgnoreCase));
                    if (flat.Key == Guid.Empty || S("name") is not { Length: > 0 } name) continue;
                    var result = await mediator.Send(new DigitalSocieties.Visitor.Application.Commands.AddVisitorCommand(
                        cu.SocietyId.Value, flat.Key, name, S("phone"), S("purpose") ?? "Guest",
                        S("vehicle_number"), S("photo_url")), ct);
                    if (result.IsSuccess) applied++;
                }
            }
            return Results.Ok(new { applied });
        }).RequireAuthorization();

        return group;
    }
}
