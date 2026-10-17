using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using DigitalSocieties.Wallet.Infrastructure.Persistence;
using DigitalSocieties.Wallet.Infrastructure.Settings;

namespace DigitalSocieties.Wallet.Infrastructure;

public static class WalletServiceExtensions
{
    public static IServiceCollection AddWalletModule(
        this IServiceCollection services, IConfiguration config)
    {
        services.Configure<WalletSettings>(config.GetSection(WalletSettings.SectionName));

        services.AddDbContext<WalletDbContext>(opts =>
            opts.UseNpgsql(config.GetConnectionString("Postgres"),
                npgsql =>
                {
                    npgsql.MigrationsAssembly(typeof(WalletDbContext).Assembly.GetName().Name);
                    npgsql.MigrationsHistoryTable("__ef_migrations", "wallet");
                }));

                // Without this the module's command/query handlers are never found and every endpoint fails with 422.
        services.AddMediatR(cfg =>
            cfg.RegisterServicesFromAssembly(typeof(WalletServiceExtensions).Assembly));

        return services;
    }
}
