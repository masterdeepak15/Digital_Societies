using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using DigitalSocieties.Parking.Infrastructure.Persistence;

namespace DigitalSocieties.Parking.Infrastructure;

/// <summary>
/// OCP: wiring a new module = one call here, no changes to existing code.
/// </summary>
public static class ParkingServiceExtensions
{
    public static IServiceCollection AddParkingModule(
        this IServiceCollection services, IConfiguration config)
    {
        services.AddDbContext<ParkingDbContext>(opts =>
            opts.UseNpgsql(config.GetConnectionString("Postgres"),
                npgsql =>
                {
                    npgsql.MigrationsAssembly(typeof(ParkingDbContext).Assembly.GetName().Name);
                    npgsql.MigrationsHistoryTable("__ef_migrations", "parking");
                }));

        // MediatR handlers are picked up automatically via assembly scanning in Program.cs
                // Without this the module's command/query handlers are never found and every endpoint fails with 422.
        services.AddMediatR(cfg =>
            cfg.RegisterServicesFromAssembly(typeof(ParkingServiceExtensions).Assembly));

        return services;
    }
}
