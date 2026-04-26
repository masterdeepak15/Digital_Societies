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
                npgsql => npgsql.MigrationsHistoryTable("__ef_migrations", "marketplace")));
        return services;
    }
}
