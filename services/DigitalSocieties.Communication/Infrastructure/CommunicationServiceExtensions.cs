using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Communication.Infrastructure.Persistence;
using DigitalSocieties.Communication.Infrastructure.Channels;
using DigitalSocieties.Communication.Infrastructure.Hubs;
using DigitalSocieties.Visitor.Infrastructure.Hubs;

namespace DigitalSocieties.Communication.Infrastructure;

public static class CommunicationServiceExtensions
{
    public static IServiceCollection AddCommunicationModule(
        this IServiceCollection services, IConfiguration config)
    {
        services.Configure<Msg91Settings>(config.GetSection(Msg91Settings.SectionName));

        services.AddDbContext<CommunicationDbContext>(opts =>
            opts.UseNpgsql(config.GetConnectionString("Postgres"),
                npg => npg.MigrationsHistoryTable("__ef_migrations", "communication")));

        // HTTP client for MSG91
        services.AddHttpClient("msg91");

        // OCP: Register all notification channels — add WhatsApp/Push/Email here without changing callers
        services.AddScoped<INotificationChannel, Msg91SmsChannel>();

        // SignalR hub notifier (concrete implementation of ISocietyHubNotifier from Visitor module)
        // Overrides the NullHubNotifier registered by VisitorServiceExtensions
        services.AddScoped<ISocietyHubNotifier, SignalRHubNotifier>();

        services.AddMediatR(cfg =>
            cfg.RegisterServicesFromAssembly(typeof(CommunicationServiceExtensions).Assembly));

        return services;
    }
}
