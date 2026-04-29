using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Identity.Infrastructure.Persistence;
using DigitalSocieties.Shared.Contracts;
using Microsoft.AspNetCore.Mvc;

namespace DigitalSocieties.Api.Endpoints.Settings;

/// <summary>
/// Society settings — read and update core society configuration.
/// GET  /api/v1/settings  → returns society name, address, tier, flat count
/// PATCH /api/v1/settings → updates name and/or address (admin only)
/// </summary>
public static class SettingsEndpoints
{
    public static RouteGroupBuilder MapSettingsEndpoints(this RouteGroupBuilder g)
    {
        // GET /api/v1/settings
        g.MapGet("/", async (
            IdentityDbContext db,
            ICurrentUser      cu,
            CancellationToken ct) =>
        {
            if (cu.SocietyId is null) return Results.BadRequest("Society context required.");
            var society = await db.Societies
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == cu.SocietyId, ct);
            if (society is null) return Results.NotFound("Society not found.");

            return Results.Ok(new {
                society.Id,
                society.Name,
                society.Address,
                society.RegistrationNumber,
                society.Tier,
                society.IsActive,
                society.TotalFlats,
            });
        })
        .RequireAuthorization("AdminOnly")
        .WithName("GetSettings")
        .WithSummary("Get society settings and configuration")
        .WithTags("Settings");

        // PATCH /api/v1/settings
        g.MapPatch("/", async (
            [FromBody] UpdateSettingsRequest body,
            IdentityDbContext db,
            ICurrentUser      cu,
            CancellationToken ct) =>
        {
            if (cu.SocietyId is null) return Results.BadRequest("Society context required.");
            var society = await db.Societies
                .FirstOrDefaultAsync(s => s.Id == cu.SocietyId, ct);
            if (society is null) return Results.NotFound("Society not found.");

            // Use raw SQL update to avoid exposing a public setter on the domain entity
            if (body.Name is not null)
                await db.Database.ExecuteSqlRawAsync(
                    "UPDATE identity.societies SET name = {0}, updated_at = {1} WHERE id = {2}",
                    body.Name, DateTimeOffset.UtcNow, cu.SocietyId);

            if (body.Address is not null)
                await db.Database.ExecuteSqlRawAsync(
                    "UPDATE identity.societies SET address = {0}, updated_at = {1} WHERE id = {2}",
                    body.Address, DateTimeOffset.UtcNow, cu.SocietyId);

            return Results.Ok(new { updated = true });
        })
        .RequireAuthorization("AdminOnly")
        .WithName("UpdateSettings")
        .WithSummary("Update society name and/or address")
        .WithTags("Settings");

        return g;
    }

    public sealed record UpdateSettingsRequest(string? Name, string? Address);
}
