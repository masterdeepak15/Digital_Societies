using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Complaint.Infrastructure.Persistence;

namespace DigitalSocieties.Complaint.Infrastructure;

public static class ComplaintServiceExtensions
{
    public static IServiceCollection AddComplaintModule(
        this IServiceCollection services, IConfiguration config)
    {
        services.AddDbContext<ComplaintDbContext>(opts =>
            opts.UseNpgsql(config.GetConnectionString("Postgres"),
                npg =>
                {
                    npg.MigrationsAssembly(typeof(ComplaintDbContext).Assembly.GetName().Name);
                    npg.MigrationsHistoryTable("__ef_migrations", "complaint");
                }));

        services.AddMediatR(cfg =>
            cfg.RegisterServicesFromAssembly(typeof(ComplaintServiceExtensions).Assembly));

        return services;
    }
}
