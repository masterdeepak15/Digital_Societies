using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Complaint.Domain.Entities;
using DigitalSocieties.Shared.Contracts;

namespace DigitalSocieties.Complaint.Infrastructure.Persistence;

public sealed class ComplaintDbContext : DbContext
{
    private readonly ICurrentUser _cu;

    public ComplaintDbContext(DbContextOptions<ComplaintDbContext> opts, ICurrentUser cu)
        : base(opts) => _cu = cu;

    public DbSet<Complaint.Domain.Entities.Complaint> Complaints  => Set<Complaint.Domain.Entities.Complaint>();
    public DbSet<ComplaintUpdate>                      Updates     => Set<ComplaintUpdate>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.HasDefaultSchema("complaint");

        mb.Entity<Complaint.Domain.Entities.Complaint>(b =>
        {
            b.ToTable("complaints");
            b.HasKey(e => e.Id);
            b.Property(e => e.Title).HasMaxLength(200).IsRequired();
            b.Property(e => e.Description).HasMaxLength(2000).IsRequired();
            b.Property(e => e.Category).HasMaxLength(50).IsRequired();
            b.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
            b.Property(e => e.Priority).HasConversion<string>().HasMaxLength(20);
            b.Property(e => e.Resolution).HasMaxLength(2000);
            // Store image URLs as JSON array
            b.Property(e => e.ImageUrls)
                .HasColumnType("jsonb")
                .HasConversion(
                    v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                    v => System.Text.Json.JsonSerializer.Deserialize<List<string>>(v, (System.Text.Json.JsonSerializerOptions?)null)!);
            b.HasMany(e => e.Updates).WithOne().HasForeignKey(u => u.ComplaintId);
            b.HasIndex(e => new { e.SocietyId, e.Status });
            b.HasQueryFilter(e => !e.IsDeleted);
        });

        mb.Entity<ComplaintUpdate>(b =>
        {
            b.ToTable("complaint_updates");
            b.HasKey(e => e.Id);
            b.Property(e => e.Comment).HasMaxLength(2000).IsRequired();
            b.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
        });
    }

    public override async Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        foreach (var e in ChangeTracker.Entries<Shared.Domain.Entities.AuditableEntity>())
        {
            if (e.State == EntityState.Added)   { e.Entity.CreatedAt = now; e.Entity.CreatedBy = _cu.UserId; e.Entity.UpdatedAt = now; }
            if (e.State == EntityState.Modified) { e.Entity.UpdatedAt = now; e.Entity.UpdatedBy = _cu.UserId; }
        }
        return await base.SaveChangesAsync(ct);
    }
}
