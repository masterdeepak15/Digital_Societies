using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Communication.Domain.Entities;
using DigitalSocieties.Communication.Infrastructure.Push;
using DigitalSocieties.Shared.Contracts;

namespace DigitalSocieties.Communication.Infrastructure.Persistence;

public sealed class CommunicationDbContext : DbContext
{
    private readonly ICurrentUser _cu;
    public CommunicationDbContext(DbContextOptions<CommunicationDbContext> opts, ICurrentUser cu)
        : base(opts) => _cu = cu;

    public DbSet<Notice>    Notices    => Set<Notice>();
    public DbSet<PushToken> PushTokens => Set<PushToken>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.HasDefaultSchema("communication");

        mb.Entity<Notice>(b =>
        {
            b.ToTable("notices");
            b.HasKey(e => e.Id);
            b.Property(e => e.Title).HasMaxLength(300).IsRequired();
            b.Property(e => e.Body).IsRequired();
            b.Property(e => e.Type).HasConversion<string>().HasMaxLength(20);
            b.HasIndex(e => new { e.SocietyId, e.CreatedAt });
            b.HasQueryFilter(e => !e.IsDeleted);
        });

        mb.Entity<PushToken>(b =>
        {
            b.ToTable("push_tokens");
            b.HasKey(e => e.Id);
            b.Property(e => e.UserId).HasColumnName("user_id").IsRequired();
            b.Property(e => e.SocietyId).HasColumnName("society_id").IsRequired();
            b.Property(e => e.ExpoPushToken).HasColumnName("expo_push_token")
                .HasMaxLength(200).IsRequired();
            b.Property(e => e.IsActive).HasColumnName("is_active").HasDefaultValue(true);
            b.Property(e => e.CreatedAt).HasColumnName("created_at");
            b.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            b.HasIndex(e => e.UserId).HasDatabaseName("ix_push_tokens_user_id");
            b.HasIndex(e => e.ExpoPushToken)
                .HasDatabaseName("ix_push_tokens_expo_token").IsUnique();
        });
    }

    public override async Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        foreach (var e in ChangeTracker.Entries<Shared.Domain.Entities.AuditableEntity>())
        {
            if (e.State == EntityState.Added)    { e.Entity.CreatedAt = now; e.Entity.CreatedBy = _cu.UserId; e.Entity.UpdatedAt = now; }
            if (e.State == EntityState.Modified)  { e.Entity.UpdatedAt = now; e.Entity.UpdatedBy = _cu.UserId; }
        }
        return await base.SaveChangesAsync(ct);
    }
}
