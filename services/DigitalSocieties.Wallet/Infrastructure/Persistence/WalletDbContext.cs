using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Wallet.Domain.Entities;

namespace DigitalSocieties.Wallet.Infrastructure.Persistence;

public sealed class WalletDbContext : DbContext
{
    public WalletDbContext(DbContextOptions<WalletDbContext> options) : base(options) { }

    public DbSet<WalletAccount>     WalletAccounts     { get; set; } = null!;
    public DbSet<WalletTransaction> WalletTransactions { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder m)
    {
        base.OnModelCreating(m);

        m.Entity<WalletAccount>(e =>
        {
            e.ToTable("wallet_accounts", "wallet");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            e.Property(x => x.SocietyId).HasColumnName("society_id");
            e.Property(x => x.FlatId).HasColumnName("flat_id");
            e.Property(x => x.OwnerId).HasColumnName("owner_id");
            e.Property(x => x.BalancePaise).HasColumnName("balance_paise");
            e.Property(x => x.IsActive).HasColumnName("is_active").HasDefaultValue(true);
            e.Property("IsDeleted").HasColumnName("is_deleted").HasDefaultValue(false);
            e.Property("CreatedAt").HasColumnName("created_at").HasDefaultValueSql("NOW()");
            e.Property("CreatedBy").HasColumnName("created_by");
            e.Property("UpdatedAt").HasColumnName("updated_at").HasDefaultValueSql("NOW()");
            e.Property("UpdatedBy").HasColumnName("updated_by");

            e.HasIndex(new[] { nameof(WalletAccount.SocietyId), nameof(WalletAccount.FlatId) })
             .HasDatabaseName("ix_wallet_accounts_society_flat").IsUnique();

            e.HasMany(w => w.Transactions)
             .WithOne()
             .HasForeignKey(t => t.WalletId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        m.Entity<WalletTransaction>(e =>
        {
            e.ToTable("wallet_transactions", "wallet");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            e.Property(x => x.WalletId).HasColumnName("wallet_id");
            e.Property(x => x.SocietyId).HasColumnName("society_id");
            e.Property(x => x.AmountPaise).HasColumnName("amount_paise");
            e.Property(x => x.Direction).HasColumnName("direction").HasConversion<string>().HasMaxLength(10);
            e.Property(x => x.Type).HasColumnName("type").HasConversion<string>().HasMaxLength(30);
            e.Property(x => x.Description).HasColumnName("description").HasMaxLength(500);
            e.Property(x => x.BalanceAfterPaise).HasColumnName("balance_after_paise");
            e.Property(x => x.ReferenceId).HasColumnName("reference_id").HasMaxLength(100);
            e.Property(x => x.CreatedAt2).HasColumnName("created_at").HasDefaultValueSql("NOW()");
            e.Property("IsDeleted").HasColumnName("is_deleted").HasDefaultValue(false);
            e.Property("CreatedBy").HasColumnName("created_by");
            e.Property("UpdatedAt").HasColumnName("updated_at").HasDefaultValueSql("NOW()");
            e.Property("UpdatedBy").HasColumnName("updated_by");

            e.HasIndex(x => x.WalletId).HasDatabaseName("ix_wallet_transactions_wallet_id");
            e.HasIndex(x => x.ReferenceId).HasDatabaseName("ix_wallet_transactions_ref_id");
        });
    }
}
