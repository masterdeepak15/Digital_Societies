using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Facility.Infrastructure.Persistence;

namespace DigitalSocieties.Facility.Infrastructure;

public static class FacilityServiceExtensions
{
    public static IServiceCollection AddFacilityModule(
        this IServiceCollection services, IConfiguration config)
    {
        services.AddDbContext<FacilityDbContext>(opts =>
            opts.UseNpgsql(config.GetConnectionString("Postgres"),
                npg => npg.MigrationsHistoryTable("__ef_migrations", "facility")));

        services.AddMediatR(cfg =>
            cfg.RegisterServicesFromAssembly(typeof(FacilityServiceExtensions).Assembly));

        return services;
    }
}
