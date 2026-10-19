using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Communication.Infrastructure.Persistence;
using DigitalSocieties.Communication.Infrastructure.Channels;
using DigitalSocieties.Communication.Infrastructure.Hubs;
using DigitalSocieties.Communication.Infrastructure.Push;
using DigitalSocieties.Visitor.Infrastructure.Hubs;
using DigitalSocieties.Communication.Application.Chat;
using DigitalSocieties.Communication.Infrastructure.Chat;

namespace DigitalSocieties.Communication.Infrastructure;

public static class CommunicationServiceExtensions
{
    public static IServiceCollection AddCommunicationModule(
        this IServiceCollection services, IConfiguration config)
    {
        services.Configure<Msg91Settings>(config.GetSection(Msg91Settings.SectionName));
        services.Configure<EmailSettings>(config.GetSection(EmailSettings.SectionName));

        services.AddDbContext<CommunicationDbContext>(opts =>
            opts.UseNpgsql(config.GetConnectionString("Postgres"),
                npg =>
                {
                    npg.MigrationsAssembly(typeof(CommunicationDbContext).Assembly.GetName().Name);
                    npg.MigrationsHistoryTable("__ef_migrations", "communication");
                }));

        // HTTP clients
        services.AddHttpClient("msg91");
        services.AddHttpClient("expo");  // Expo push notifications

        // OCP: Register all notification channels (injected as IEnumerable<INotificationChannel>)
        services.AddScoped<SmtpEmailChannel>();
        services.AddScoped<ExpoPushChannel>();
        services.AddScoped<INotificationChannel>(sp => sp.GetRequiredService<SmtpEmailChannel>());
        services.AddScoped<INotificationChannel>(sp => sp.GetRequiredService<ExpoPushChannel>());

        // SMS is optional (paid): register it only when an API key is configured.
        if (config.GetSection(Msg91Settings.SectionName).Get<Msg91Settings>()?.IsConfigured == true)
        {
            services.AddScoped<Msg91SmsChannel>();
            services.AddScoped<INotificationChannel>(sp => sp.GetRequiredService<Msg91SmsChannel>());
        }

        // Fallback dispatcher: push → SMS (guard offline hardening).
        // Registered against the Shared interface so Visitor/Billing modules can inject it.
        services.AddScoped<INotificationDispatcher, FallbackNotificationDispatcher>();

        // Push token store
        services.AddScoped<IPushTokenStore, PostgresPushTokenStore>();

        // SignalR hub notifier (overrides NullHubNotifier from VisitorServiceExtensions)
        services.AddScoped<ISocietyHubNotifier, SignalRHubNotifier>();

        // Chat: the people list, who is online, and live / push delivery
        services.AddSingleton<PresenceTracker>();
        services.AddScoped<IChatDirectory, PostgresChatDirectory>();
        services.AddScoped<IChatPresence, ChatPresence>();
        services.AddScoped<IChatNotifier, ChatNotifier>();

        services.AddMediatR(cfg =>
            cfg.RegisterServicesFromAssembly(typeof(CommunicationServiceExtensions).Assembly));

        return services;
    }
}
