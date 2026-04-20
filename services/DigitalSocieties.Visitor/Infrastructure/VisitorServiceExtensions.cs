using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Visitor.Infrastructure.Persistence;
using DigitalSocieties.Visitor.Infrastructure.Security;
using DigitalSocieties.Visitor.Infrastructure.Hubs;

namespace DigitalSocieties.Visitor.Infrastructure;

public static class VisitorServiceExtensions
{
    public static IServiceCollection AddVisitorModule(
        this IServiceCollection services, IConfiguration config)
    {
        services.Configure<QrTokenSettings>(config.GetSection(QrTokenSettings.SectionName));

        services.AddDbContext<VisitorDbContext>(opts =>
            opts.UseNpgsql(config.GetConnectionString("Postgres"),
                npg => npg.MigrationsHistoryTable("__ef_migrations", "visitor")));

        services.AddScoped<IQrTokenService, QrTokenService>();

        // ISocietyHubNotifier is registered by the API host (it needs IHubContext<SocietyHub>)
        // so we register a placeholder here and the API host overrides it
        services.AddScoped<ISocietyHubNotifier, NullHubNotifier>();

        services.AddMediatR(cfg =>
            cfg.RegisterServicesFromAssembly(typeof(VisitorServiceExtensions).Assembly));

        return services;
    }
}

// Null-object: used in tests and when SignalR isn't connected. (LSP + OCP)
internal sealed class NullHubNotifier : ISocietyHubNotifier
{
    public Task NotifyFlatAsync(Guid f, string e, object p, CancellationToken ct)            => Task.CompletedTask;
    public Task NotifySocietyGuardsAsync(Guid s, string e, object p, CancellationToken ct)  => Task.CompletedTask;
    public Task NotifySocietyAsync(Guid s, string e, object p, CancellationToken ct)        => Task.CompletedTask;
}
