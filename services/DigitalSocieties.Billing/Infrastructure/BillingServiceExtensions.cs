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
                npg =>
                {
                    npg.MigrationsAssembly(typeof(BillingDbContext).Assembly.GetName().Name);
                    npg.MigrationsHistoryTable("__ef_migrations", "billing");
                }));

        // Razorpay HTTP client (add Microsoft.Extensions.Http.Resilience for retry in prod)
        services.AddHttpClient("razorpay");

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
            "SELECT \"Id\" AS \"Value\" FROM identity.\"Flats\" WHERE \"SocietyId\" = {0} AND \"IsDeleted\" = FALSE",
            societyId).ToListAsync(ct);
        return ids;
    }

    public async Task<Dictionary<Guid, string>> GetFlatLabelsAsync(Guid societyId, CancellationToken ct)
    {
        var rows = await _db.Database.SqlQueryRaw<FlatLabelRow>(
            "SELECT \"Id\" AS \"Id\", \"Wing\" AS \"Wing\", \"Number\" AS \"Number\" FROM identity.\"Flats\" WHERE \"SocietyId\" = {0} AND \"IsDeleted\" = FALSE",
            societyId).ToListAsync(ct);
        return rows.ToDictionary(r => r.Id, r => $"{r.Wing}-{r.Number}");
    }

    private sealed record FlatLabelRow(Guid Id, string Wing, string Number);
}
