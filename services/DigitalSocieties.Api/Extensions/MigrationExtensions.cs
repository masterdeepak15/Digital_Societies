using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Identity.Infrastructure.Persistence;

namespace DigitalSocieties.Api.Extensions;

public static class MigrationExtensions
{
    public static async Task MigrateAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
        await db.Database.MigrateAsync();
    }
}
