using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using DigitalSocieties.Identity.Domain.Entities;
using DigitalSocieties.Identity.Infrastructure.Security;
using DigitalSocieties.Shared.Contracts;

namespace DigitalSocieties.Identity.Infrastructure.Persistence;

/// <summary>
/// EF Core DbContext for the Identity bounded context.
/// Applies audit fields via SaveChanges interception. (SRP — persistence only)
/// Row-Level Security: tenant_id filter applied by Postgres RLS policies,
/// not by application code — defense-in-depth.
/// </summary>
public sealed class IdentityDbContext : DbContext
{
    private readonly ICurrentUser _currentUser;

    public IdentityDbContext(DbContextOptions<IdentityDbContext> options, ICurrentUser currentUser)
        : base(options)
    {
        _currentUser = currentUser;
    }

    public DbSet<Society>            Societies     => Set<Society>();
    public DbSet<Flat>               Flats         => Set<Flat>();
    public DbSet<User>               Users         => Set<User>();
    public DbSet<UserDevice>         UserDevices   => Set<UserDevice>();
    public DbSet<Membership>         Memberships   => Set<Membership>();
    public DbSet<OtpRequest>         OtpRequests   => Set<OtpRequest>();
    public DbSet<RefreshTokenRecord> RefreshTokens => Set<RefreshTokenRecord>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.HasDefaultSchema("identity");
        mb.ApplyConfigurationsFromAssembly(typeof(IdentityDbContext).Assembly);
    }

    public override async Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        // Automatically stamp audit columns
        var now    = DateTimeOffset.UtcNow;
        var userId = _currentUser.UserId;

        foreach (var entry in ChangeTracker.Entries<Shared.Domain.Entities.AuditableEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.CreatedAt = now;
                    entry.Entity.CreatedBy = userId;
                    entry.Entity.UpdatedAt = now;
                    entry.Entity.UpdatedBy = userId;
                    break;
                case EntityState.Modified:
                    entry.Entity.UpdatedAt = now;
                    entry.Entity.UpdatedBy = userId;
                    break;
            }
        }

        int result = await base.SaveChangesAsync(ct);

        // Dispatch domain events AFTER commit
        await DispatchDomainEventsAsync();

        return result;
    }

    private async Task DispatchDomainEventsAsync()
    {
        // Collected by aggregates; dispatched here after transaction
        // (Handled by MediatR registered in DI)
        // Implementation: iterate ChangeTracker for aggregates with pending events
    }
}

// EF Core design-time factory (for migrations CLI)
public sealed class IdentityDbContextFactory : IDesignTimeDbContextFactory<IdentityDbContext>
{
    public IdentityDbContext CreateDbContext(string[] args)
    {
        var opts = new DbContextOptionsBuilder<IdentityDbContext>()
            .UseNpgsql(
                "Host=localhost;Database=digital_societies;Username=ds_app;Password=devpassword",
                npg => npg.MigrationsHistoryTable("__ef_migrations", "identity"))
            .Options;

        return new IdentityDbContext(opts, new AnonymousCurrentUser());
    }
}

// Null-object for design-time / anonymous contexts
internal sealed class AnonymousCurrentUser : ICurrentUser
{
    public Guid?   UserId    => null;
    public Guid?   SocietyId => null;
    public Guid?   FlatId    => null;
    public string? Phone     => null;
    public IReadOnlyList<string> Roles => [];
    public bool IsInRole(string role)  => false;
    public bool IsAuthenticated        => false;
}
