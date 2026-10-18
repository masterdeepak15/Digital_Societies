using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using DigitalSocieties.Marketplace.Infrastructure.Persistence;

namespace DigitalSocieties.Marketplace.Infrastructure;

public static class MarketplaceServiceExtensions
{
    public static IServiceCollection AddMarketplaceModule(
        this IServiceCollection services, IConfiguration config)
    {
        services.AddDbContext<MarketplaceDbContext>(opts =>
            opts.UseNpgsql(config.GetConnectionString("Postgres"),
                npgsql =>
                {
                    npgsql.MigrationsAssembly(typeof(MarketplaceDbContext).Assembly.GetName().Name);
                    npgsql.MigrationsHistoryTable("__ef_migrations", "marketplace");
                }));
                // Without this the module's command/query handlers are never found and every endpoint fails with 422.
        services.AddMediatR(cfg =>
            cfg.RegisterServicesFromAssembly(typeof(MarketplaceServiceExtensions).Assembly));

        return services;
    }
}
