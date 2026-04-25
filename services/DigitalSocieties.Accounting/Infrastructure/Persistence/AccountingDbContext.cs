using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Shared.Domain.ValueObjects;
using DigitalSocieties.Accounting.Domain.Entities;

namespace DigitalSocieties.Accounting.Infrastructure.Persistence;

public sealed class AccountingDbContext : DbContext
{
    public AccountingDbContext(DbContextOptions<AccountingDbContext> options) : base(options) { }

    public DbSet<LedgerEntry> LedgerEntries => Set<LedgerEntry>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.HasDefaultSchema("accounting");

        mb.Entity<LedgerEntry>(e =>
        {
            e.ToTable("ledger_entries");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.SocietyId).HasColumnName("society_id").IsRequired();
            e.Property(x => x.Type).HasColumnName("type")
                .HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Category).HasColumnName("category").HasMaxLength(100);
            e.Property(x => x.Description).HasColumnName("description").HasMaxLength(500);
            e.OwnsOne(x => x.Amount, m =>
            {
                m.Property(v => v.Paise).HasColumnName("amount_paise");
                m.Property(v => v.Currency).HasColumnName("currency").HasMaxLength(3);
            });
            e.Property(x => x.EntryDate).HasColumnName("entry_date");
            e.Property(x => x.PostedBy).HasColumnName("posted_by");
            e.Property(x => x.Status).HasColumnName("status")
                .HasConversion<string>().HasMaxLength(30);
            e.Property(x => x.ApprovedBy).HasColumnName("approved_by");
            e.Property(x => x.ApprovedAt).HasColumnName("approved_at");
            e.Property(x => x.RejectionReason).HasColumnName("rejection_reason").HasMaxLength(500);
            e.Property(x => x.ReceiptUrl).HasColumnName("receipt_url").HasMaxLength(500);
            e.Property(x => x.IsDeleted).HasColumnName("is_deleted").HasDefaultValue(false);
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.CreatedBy).HasColumnName("created_by");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            e.Property(x => x.UpdatedBy).HasColumnName("updated_by");

            e.HasIndex(x => x.SocietyId).HasDatabaseName("ix_ledger_entries_society_id");
            e.HasIndex(x => new { x.SocietyId, x.EntryDate })
                .HasDatabaseName("ix_ledger_entries_society_date");
        });
    }
}
