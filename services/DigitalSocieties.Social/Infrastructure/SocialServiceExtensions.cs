using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Social.Infrastructure.Persistence;
using DigitalSocieties.Social.Infrastructure.Hubs;

namespace DigitalSocieties.Social.Infrastructure;

/// <summary>
/// Registers all Social module dependencies.
/// Call AddSocialModule() in Program.cs after AddCommunicationModule()
/// so the Communication module can override NullSocialHubNotifier with
/// its SignalR implementation.
/// </summary>
public static class SocialServiceExtensions
{
    public static IServiceCollection AddSocialModule(
        this IServiceCollection services,
        IConfiguration config)
    {
        // EF Core — social schema, same Postgres instance
        services.AddDbContext<SocialDbContext>(opts =>
            opts.UseNpgsql(
                config.GetConnectionString("Postgres"),
                pg => pg.EnableRetryOnFailure(3)));

        // Null-object default — overridden by Communication module's SignalRSocialHubNotifier
        services.AddScoped<ISocialHubNotifier, NullSocialHubNotifier>();

        // MediatR handlers in this assembly
        services.AddMediatR(cfg =>
            cfg.RegisterServicesFromAssembly(typeof(SocialServiceExtensions).Assembly));

        return services;
    }
}
