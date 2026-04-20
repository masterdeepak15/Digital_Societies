using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using DigitalSocieties.Billing.Domain.Entities;
using DigitalSocieties.Shared.Contracts;
using DigitalSocieties.Shared.Domain.ValueObjects;

namespace DigitalSocieties.Billing.Infrastructure.Persistence;

public sealed class BillingDbContext : DbContext
{
    private readonly ICurrentUser _currentUser;

    public BillingDbContext(DbContextOptions<BillingDbContext> options, ICurrentUser currentUser)
        : base(options) => _currentUser = currentUser;

    public DbSet<Bill>    Bills    => Set<Bill>();
    public DbSet<Payment> Payments => Set<Payment>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.HasDefaultSchema("billing");
        mb.ApplyConfigurationsFromAssembly(typeof(BillingDbContext).Assembly);
    }

    public override async Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        var now    = DateTimeOffset.UtcNow;
        var userId = _currentUser.UserId;
        foreach (var e in ChangeTracker.Entries<Shared.Domain.Entities.AuditableEntity>())
        {
            if (e.State == EntityState.Added)
                { e.Entity.CreatedAt = now; e.Entity.CreatedBy = userId; e.Entity.UpdatedAt = now; }
            if (e.State == EntityState.Modified)
                { e.Entity.UpdatedAt = now; e.Entity.UpdatedBy = userId; }
        }
        return await base.SaveChangesAsync(ct);
    }
}

public sealed class BillingDbContextFactory : IDesignTimeDbContextFactory<BillingDbContext>
{
    public BillingDbContext CreateDbContext(string[] args)
    {
        var opts = new DbContextOptionsBuilder<BillingDbContext>()
            .UseNpgsql("Host=localhost;Database=digital_societies;Username=ds_app;Password=devpassword",
                npg => npg.MigrationsHistoryTable("__ef_migrations", "billing"))
            .Options;
        return new BillingDbContext(opts, new NullCurrentUser());
    }
    private sealed class NullCurrentUser : ICurrentUser
    {
        public Guid? UserId => null; public Guid? SocietyId => null;
        public Guid? FlatId => null; public string? Phone => null;
        public IReadOnlyList<string> Roles => [];
        public bool IsInRole(string r) => false; public bool IsAuthenticated => false;
    }
}
