using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Communication.Infrastructure.Persistence;
using DigitalSocieties.Communication.Infrastructure.Channels;
using DigitalSocieties.Communication.Infrastructure.Hubs;
using DigitalSocieties.Communication.Infrastructure.Push;
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

        // HTTP clients
        services.AddHttpClient("msg91");
        services.AddHttpClient("expo");  // Expo push notifications

        // OCP: Register all notification channels (injected as IEnumerable<INotificationChannel>)
        services.AddScoped<Msg91SmsChannel>();
        services.AddScoped<ExpoPushChannel>();
        services.AddScoped<INotificationChannel>(sp => sp.GetRequiredService<Msg91SmsChannel>());
        services.AddScoped<INotificationChannel>(sp => sp.GetRequiredService<ExpoPushChannel>());

        // Fallback dispatcher: push → SMS (guard offline hardening).
        // Registered against the Shared interface so Visitor/Billing modules can inject it.
        services.AddScoped<INotificationDispatcher, FallbackNotificationDispatcher>();

        // Push token store
        services.AddScoped<IPushTokenStore, PostgresPushTokenStore>();

        // SignalR hub notifier (overrides NullHubNotifier from VisitorServiceExtensions)
        services.AddScoped<ISocietyHubNotifier, SignalRHubNotifier>();

        services.AddMediatR(cfg =>
            cfg.RegisterServicesFromAssembly(typeof(CommunicationServiceExtensions).Assembly));

        return services;
    }
}
