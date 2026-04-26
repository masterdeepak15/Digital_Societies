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
                npgsql => npgsql.MigrationsHistoryTable("__ef_migrations", "parking")));

        // MediatR handlers are picked up automatically via assembly scanning in Program.cs
        return services;
    }
}
