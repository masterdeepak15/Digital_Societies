using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Identity.Infrastructure.Persistence;
using DigitalSocieties.Billing.Infrastructure.Persistence;
using DigitalSocieties.Visitor.Infrastructure.Persistence;
using DigitalSocieties.Complaint.Infrastructure.Persistence;
using DigitalSocieties.Communication.Infrastructure.Persistence;
using DigitalSocieties.Social.Infrastructure.Persistence;
using DigitalSocieties.Accounting.Infrastructure.Persistence;
using DigitalSocieties.Facility.Infrastructure.Persistence;
using DigitalSocieties.Parking.Infrastructure.Persistence;
using DigitalSocieties.Calling.Infrastructure.Persistence;
using DigitalSocieties.Marketplace.Infrastructure.Persistence;
using DigitalSocieties.Wallet.Infrastructure.Persistence;
using DigitalSocieties.Api.Infrastructure.Seeding;

namespace DigitalSocieties.Api.Extensions;

public static class MigrationExtensions
{
    /// <summary>
    /// Applies EF Core migrations for every bounded-context DbContext, then seeds
    /// demo data in Development. Call once at startup before <c>app.Run()</c>.
    ///
    /// Modules with formal migrations → <c>MigrateAsync()</c> (idempotent).
    /// Modules pending migration scaffolding → <c>EnsureCreatedAsync()</c> as a dev
    /// fallback (TODO: run <c>dotnet ef migrations add InitialCreate</c> for each).
    /// </summary>
    public static async Task MigrateAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var sp     = scope.ServiceProvider;
        var logger = sp.GetRequiredService<ILogger<Program>>();
        var env    = sp.GetRequiredService<IWebHostEnvironment>();

        // ── Modules WITH formal EF migrations ────────────────────────────────
        await MigrateDbAsync<IdentityDbContext>(sp,     logger);
        await MigrateDbAsync<AccountingDbContext>(sp,   logger);
        await MigrateDbAsync<FacilityDbContext>(sp,     logger);
        await MigrateDbAsync<ParkingDbContext>(sp,      logger);
        await MigrateDbAsync<CallingDbContext>(sp,      logger);
        await MigrateDbAsync<MarketplaceDbContext>(sp,  logger);
        await MigrateDbAsync<WalletDbContext>(sp,       logger);

        // ── Modules pending migration scaffolding — EnsureCreated for dev ─────
        // TODO: for each of these, run:
        //   dotnet ef migrations add InitialCreate -p services/<Module> -s services/DigitalSocieties.Api
        // then switch the call below to MigrateDbAsync.
        await EnsureCreatedAsync<BillingDbContext>(sp,       logger);
        await EnsureCreatedAsync<VisitorDbContext>(sp,       logger);
        await EnsureCreatedAsync<ComplaintDbContext>(sp,     logger);
        await EnsureCreatedAsync<CommunicationDbContext>(sp, logger);
        await EnsureCreatedAsync<SocialDbContext>(sp,        logger);

        // ── Seed demo data in Development ────────────────────────────────────
        if (env.IsDevelopment())
            await DataSeeder.SeedAsync(sp, logger);
    }

    private static async Task MigrateDbAsync<TContext>(IServiceProvider sp, ILogger logger)
        where TContext : DbContext
    {
        var db = sp.GetRequiredService<TContext>();
        var pending = (await db.Database.GetPendingMigrationsAsync()).ToList();
        if (pending.Count > 0)
        {
            logger.LogInformation("[Migration] Applying {Count} pending migration(s) for {Context}…",
                pending.Count, typeof(TContext).Name);
            await db.Database.MigrateAsync();
        }
    }

    private static async Task EnsureCreatedAsync<TContext>(IServiceProvider sp, ILogger logger)
        where TContext : DbContext
    {
        var db      = sp.GetRequiredService<TContext>();
        bool created = await db.Database.EnsureCreatedAsync();
        if (created)
            logger.LogWarning("[Migration] {Context}: schema created via EnsureCreated " +
                              "(no formal migrations yet — add them before going to production).",
                typeof(TContext).Name);
    }
}
