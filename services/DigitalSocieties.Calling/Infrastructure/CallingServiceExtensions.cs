using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using DigitalSocieties.Calling.Domain.Contracts;
using DigitalSocieties.Calling.Infrastructure.Persistence;
using DigitalSocieties.Calling.Infrastructure.Settings;

namespace DigitalSocieties.Calling.Infrastructure;

/// <summary>
/// OCP: swap A/V provider (LiveKit ↔ JitsiMeet) by changing the "Calling:Provider" config value.
/// No code changes required anywhere else.
/// </summary>
public static class CallingServiceExtensions
{
    public static IServiceCollection AddCallingModule(
        this IServiceCollection services,
        IConfiguration config)
    {
        var settings = config.GetSection(CallingSettings.SectionName).Get<CallingSettings>()
                       ?? new CallingSettings();

        services.Configure<CallingSettings>(config.GetSection(CallingSettings.SectionName));

        services.AddDbContext<CallingDbContext>(opts =>
            opts.UseNpgsql(config.GetConnectionString("Postgres"),
                npgsql => npgsql.MigrationsHistoryTable("__ef_migrations", "calling")));

        // ── Register HttpClient for LiveKit REST API ──────────────────────
        services.AddHttpClient("livekit", client =>
        {
            client.BaseAddress = new Uri(
                settings.LiveKit.ServerUrl.Replace("wss://", "https://").Replace("ws://", "http://"));
            client.Timeout = TimeSpan.FromSeconds(10);
        });

        // ── Provider selection (OCP: config-driven, no if/else in controllers) ──
        if (settings.Provider.Equals("JitsiMeet", StringComparison.OrdinalIgnoreCase))
            services.AddScoped<IVideoCallProvider, JitsiProvider>();
        else
            services.AddScoped<IVideoCallProvider, LiveKitProvider>(); // default

        return services;
    }
}
