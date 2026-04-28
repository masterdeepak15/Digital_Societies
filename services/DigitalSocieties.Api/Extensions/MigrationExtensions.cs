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

        // ── All remaining modules now have formal EF migrations ───────────────
        await MigrateDbAsync<BillingDbContext>(sp,       logger);
        await MigrateDbAsync<VisitorDbContext>(sp,       logger);
        await MigrateDbAsync<ComplaintDbContext>(sp,     logger);
        await MigrateDbAsync<CommunicationDbContext>(sp, logger);
        await MigrateDbAsync<SocialDbContext>(sp,        logger);

        // ── Seed demo data in Development ────────────────────────────────────
        if (env.IsDevelopment())
            await DataSeeder.SeedAsync(sp, logger);
    }

    private static async Task MigrateDbAsync<TContext>(IServiceProvider sp, ILogger logger)
        where TContext : DbContext
    {
        var ctx  = typeof(TContext).Name;
        var db   = sp.GetRequiredService<TContext>();

        // Log all migrations EF knows about in this context (helps diagnose empty-assembly issues)
        var all     = db.Database.GetMigrations().ToList();
        var applied = (await db.Database.GetAppliedMigrationsAsync()).ToList();
        var pending = all.Except(applied).ToList();

        logger.LogInformation("[Migration] {Context}: {All} total, {Applied} applied, {Pending} pending.",
            ctx, all.Count, applied.Count, pending.Count);

        if (pending.Count > 0)
        {
            logger.LogInformation("[Migration] {Context}: applying {Pending} migration(s): {Names}",
                ctx, pending.Count, string.Join(", ", pending));
        }

        // MigrateAsync is idempotent — always call it so it can create the history table
        // and apply any pending migrations, even if our count above returns an unexpected 0.
        await db.Database.MigrateAsync();

        logger.LogInformation("[Migration] {Context}: done.", ctx);
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
