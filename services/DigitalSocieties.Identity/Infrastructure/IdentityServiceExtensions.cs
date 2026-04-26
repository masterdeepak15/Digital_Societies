using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Identity.Infrastructure.Persistence;
using DigitalSocieties.Identity.Infrastructure.Security;
using DigitalSocieties.Identity.Infrastructure.Services;

namespace DigitalSocieties.Identity.Infrastructure;

/// <summary>
/// Extension method: the only public surface of this module that the API host touches.
/// Hides all concrete registrations (DIP — host depends on the abstraction, not the types).
/// </summary>
public static class IdentityServiceExtensions
{
    public static IServiceCollection AddIdentityModule(
        this IServiceCollection services, IConfiguration config)
    {
        // Settings
        services.Configure<JwtSettings>(config.GetSection(JwtSettings.SectionName));

        // DbContext — Postgres with Row-Level Security enabled at connection level
        services.AddDbContext<IdentityDbContext>(opts =>
            opts.UseNpgsql(
                config.GetConnectionString("Postgres"),
                npg =>
                {
                    npg.MigrationsHistoryTable("__ef_migrations", "identity");
                    npg.EnableRetryOnFailure(3);
                }));

        // Repositories
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IUnitOfWork,     UnitOfWork>();

        // Infrastructure services
        services.AddScoped<IOtpService,  OtpService>();
        services.AddScoped<IJwtService,  JwtService>();
        services.AddSingleton<IRateLimiter, RedisRateLimiter>();

        // MediatR handlers (scanned from this assembly)
        services.AddMediatR(cfg =>
            cfg.RegisterServicesFromAssembly(typeof(IdentityServiceExtensions).Assembly));

        return services;
    }
}
