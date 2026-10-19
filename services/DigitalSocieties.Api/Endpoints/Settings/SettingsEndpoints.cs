using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Identity.Infrastructure.Persistence;
using DigitalSocieties.Shared.Contracts;
using Microsoft.AspNetCore.Mvc;

namespace DigitalSocieties.Api.Endpoints.Settings;

/// <summary>
/// Society settings: the profile (name, address, registration number) and the society's own rules
/// (contact, billing, notifications, visitor security). All of it is saved on the server.
/// GET   /api/v1/settings  → profile + settings
/// PATCH /api/v1/settings  → change any of them (admin only)
/// </summary>
public static class SettingsEndpoints
{
    public static RouteGroupBuilder MapSettingsEndpoints(this RouteGroupBuilder g)
    {
        g.MapGet("/", async (IdentityDbContext db, ICurrentUser cu, CancellationToken ct) =>
        {
            if (cu.SocietyId is null) return Results.BadRequest("Society context required.");
            var society = await db.Societies.AsNoTracking().FirstOrDefaultAsync(s => s.Id == cu.SocietyId, ct);
            if (society is null) return Results.NotFound("Society not found.");

            return Results.Ok(new
            {
                society.Id, society.Name, society.Address, society.RegistrationNumber, society.Tier, society.IsActive, society.TotalFlats,
                Settings = society.Settings,
            });
        })
        .RequireAuthorization("AdminOnly")
        .WithName("GetSettings")
        .WithSummary("Get the society profile and its settings")
        .WithTags("Settings");

        g.MapPatch("/", async ([FromBody] UpdateSettingsRequest body, IdentityDbContext db, ICurrentUser cu, CancellationToken ct) =>
        {
            if (cu.SocietyId is null) return Results.BadRequest("Society context required.");
            var society = await db.Societies.FirstOrDefaultAsync(s => s.Id == cu.SocietyId, ct);
            if (society is null) return Results.NotFound("Society not found.");

            if (body.Settings is { } settings)
            {
                var problem = settings.Validate();
                if (problem is not null) return Results.BadRequest(new { code = "SETTINGS.INVALID", message = problem });
                society.SaveSettings(settings);
            }

            var reg = body.RegistrationNumber?.Trim();
            if (!string.IsNullOrEmpty(reg) && !string.Equals(reg, society.RegistrationNumber, StringComparison.Ordinal)
                && await db.Societies.AnyAsync(s => s.Id != society.Id && s.RegistrationNumber == reg, ct))
                return Results.BadRequest(new { code = "SETTINGS.REG_DUPLICATE", message = "Another society already uses that registration number." });

            society.UpdateProfile(body.Name, body.Address, reg);
            await db.SaveChangesAsync(ct);

            return Results.Ok(new { updated = true });
        })
        .RequireAuthorization("AdminOnly")
        .WithName("UpdateSettings")
        .WithSummary("Update the society profile and/or its settings")
        .WithTags("Settings");

        return g;
    }

    public sealed record UpdateSettingsRequest(string? Name, string? Address, string? RegistrationNumber, SocietySettings? Settings);
}
