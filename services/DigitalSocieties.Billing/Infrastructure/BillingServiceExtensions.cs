using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Billing.Infrastructure.Persistence;
using DigitalSocieties.Billing.Infrastructure.Payments;
using DigitalSocieties.Billing.Application.Commands;

namespace DigitalSocieties.Billing.Infrastructure;

public static class BillingServiceExtensions
{
    public static IServiceCollection AddBillingModule(
        this IServiceCollection services, IConfiguration config)
    {
        services.Configure<RazorpaySettings>(config.GetSection(RazorpaySettings.SectionName));

        services.AddDbContext<BillingDbContext>(opts =>
            opts.UseNpgsql(config.GetConnectionString("Postgres"),
                npg => npg.MigrationsHistoryTable("__ef_migrations", "billing")));

        // Razorpay HTTP client with retry policy
        services.AddHttpClient("razorpay")
            .AddStandardResilienceHandler();

        // OCP: Register Razorpay as IPaymentProvider — add Cashfree here too when needed
        services.AddScoped<IPaymentProvider, RazorpayProvider>();

        // Cross-module service (DIP — billing doesn't depend on Identity project)
        services.AddScoped<IFlatQueryService, PostgresFlatQueryService>();

        services.AddMediatR(cfg =>
            cfg.RegisterServicesFromAssembly(typeof(BillingServiceExtensions).Assembly));

        return services;
    }
}

/// <summary>
/// Queries flat data via raw Postgres (cross-schema join) without importing the Identity project.
/// DIP: billing depends on IFlatQueryService abstraction, not Identity's DbContext.
/// </summary>
internal sealed class PostgresFlatQueryService : IFlatQueryService
{
    private readonly BillingDbContext _db;
    public PostgresFlatQueryService(BillingDbContext db) => _db = db;

    public async Task<List<Guid>> GetActiveFlatIdsAsync(Guid societyId, CancellationToken ct)
    {
        // Cross-schema raw query — Postgres allows querying identity schema from billing context
        var ids = await _db.Database.SqlQueryRaw<Guid>(
            "SELECT id FROM identity.flats WHERE society_id = {0} AND is_deleted = FALSE",
            societyId).ToListAsync(ct);
        return ids;
    }
}
