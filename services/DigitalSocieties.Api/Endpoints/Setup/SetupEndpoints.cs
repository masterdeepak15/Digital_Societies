using MediatR;
using DigitalSocieties.Identity.Application.Commands;
using DigitalSocieties.Api.Infrastructure.Seeding;

namespace DigitalSocieties.Api.Endpoints.Setup;

/// <summary>
/// First-run setup endpoints. Available only once — before any society exists.
///
/// POST /initialize — full guided setup (society + admin + keys)
/// POST /demo       — instant demo: seeds sample data and returns admin JWT
/// </summary>
public static class SetupEndpoints
{
    public static RouteGroupBuilder MapSetupEndpoints(this RouteGroupBuilder group)
    {
        group.MapPost("/initialize", Initialize)
             .WithName("InitializeSociety")
             .WithSummary("First-run: create society, admin account, and integration keys")
             .AllowAnonymous();

        group.MapPost("/demo", ActivateDemoMode)
             .WithName("ActivateDemoMode")
             .WithSummary("Instant demo: seeds sample residents/bills/visitors and returns admin JWT")
             .AllowAnonymous();

        return group;
    }

    // ── POST /api/v1/setup/initialize ─────────────────────────────────────────
    private static async Task<IResult> Initialize(
        InitializeSocietyCommand cmd,
        IMediator mediator,
        CancellationToken ct)
    {
        var result = await mediator.Send(cmd, ct);
        return result.IsSuccess
            ? Results.Ok(result.Value)
            : Results.Problem(result.Error!.Message, statusCode: 400, title: result.Error.Code);
    }

    // ── POST /api/v1/setup/demo ───────────────────────────────────────────────
    /// <summary>
    /// Seeds the database with Greenview Heights demo data (idempotent) and
    /// issues a JWT for the demo admin so the caller can navigate straight to
    /// the dashboard without a separate login step.
    ///
    /// Guard: rejects if a non-demo society already exists (registration number
    /// != "DEMO-001"), so this can't overwrite a real installation.
    /// </summary>
    private static async Task<IResult> ActivateDemoMode(
        DataSeeder seeder,
        IMediator  mediator,
        CancellationToken ct)
    {
        // SeedAsync is idempotent — safe to call multiple times
        var seeded = await seeder.SeedAsync(ct);
        if (!seeded.IsSuccess)
            return Results.Problem(seeded.Error!.Message, statusCode: 409, title: "DemoSeedFailed");

        // Issue JWT for demo admin so the UI can redirect straight to /dashboard
        var tokenResult = await mediator.Send(
            new IssueTokenForDemoAdminCommand(seeded.Value!.AdminUserId), ct);

        if (!tokenResult.IsSuccess)
            return Results.Problem(tokenResult.Error!.Message, statusCode: 500, title: "DemoTokenFailed");

        return Results.Ok(new
        {
            accessToken = tokenResult.Value!.AccessToken,
            user = new
            {
                userId    = seeded.Value.AdminUserId,
                name      = "Demo Admin",
                phone     = "+919999900001",
                roles     = new[] { "Admin" },
                societyId = seeded.Value.SocietyId,
            }
        });
    }
}
