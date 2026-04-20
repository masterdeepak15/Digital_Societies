using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Visitor.Domain.Entities;
using DigitalSocieties.Shared.Contracts;

namespace DigitalSocieties.Visitor.Infrastructure.Persistence;

public sealed class VisitorDbContext : DbContext
{
    private readonly ICurrentUser _currentUser;

    public VisitorDbContext(DbContextOptions<VisitorDbContext> options, ICurrentUser cu)
        : base(options) => _currentUser = cu;

    public DbSet<Visitor.Domain.Entities.Visitor> Visitors => Set<Visitor.Domain.Entities.Visitor>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.HasDefaultSchema("visitor");

        mb.Entity<Domain.Entities.Visitor>(b =>
        {
            b.ToTable("visitors");
            b.HasKey(e => e.Id);
            b.Property(e => e.Name).HasMaxLength(200).IsRequired();
            b.Property(e => e.Phone).HasMaxLength(20);
            b.Property(e => e.Purpose).HasMaxLength(50).IsRequired();
            b.Property(e => e.VehicleNumber).HasMaxLength(20);
            b.Property(e => e.PhotoUrl).HasMaxLength(500);
            b.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
            b.Property(e => e.RejectionReason).HasMaxLength(500);
            b.Property(e => e.QrToken).HasMaxLength(1000);
            b.HasIndex(e => new { e.SocietyId, e.Status });
            b.HasIndex(e => e.FlatId);
            b.HasIndex(e => e.EntryTime);
            b.HasQueryFilter(e => !e.IsDeleted);
        });
    }

    public override async Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        foreach (var e in ChangeTracker.Entries<Shared.Domain.Entities.AuditableEntity>())
        {
            if (e.State == EntityState.Added) { e.Entity.CreatedAt = now; e.Entity.CreatedBy = _currentUser.UserId; e.Entity.UpdatedAt = now; }
            if (e.State == EntityState.Modified) { e.Entity.UpdatedAt = now; e.Entity.UpdatedBy = _currentUser.UserId; }
        }
        return await base.SaveChangesAsync(ct);
    }
}
