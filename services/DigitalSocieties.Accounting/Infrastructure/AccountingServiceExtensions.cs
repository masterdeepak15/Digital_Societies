using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Accounting.Infrastructure.Persistence;

namespace DigitalSocieties.Accounting.Infrastructure;

public static class AccountingServiceExtensions
{
    public static IServiceCollection AddAccountingModule(
        this IServiceCollection services, IConfiguration config)
    {
        services.AddDbContext<AccountingDbContext>(opts =>
            opts.UseNpgsql(config.GetConnectionString("Postgres"),
                npg =>
                {
                    npg.MigrationsAssembly(typeof(AccountingDbContext).Assembly.GetName().Name);
                    npg.MigrationsHistoryTable("__ef_migrations", "accounting");
                }));

        services.AddMediatR(cfg =>
            cfg.RegisterServicesFromAssembly(typeof(AccountingServiceExtensions).Assembly));

        return services;
    }
}
