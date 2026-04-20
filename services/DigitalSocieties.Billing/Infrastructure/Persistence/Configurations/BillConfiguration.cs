using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using DigitalSocieties.Billing.Domain.Entities;
using DigitalSocieties.Shared.Domain.ValueObjects;

namespace DigitalSocieties.Billing.Infrastructure.Persistence.Configurations;

public sealed class BillConfiguration : IEntityTypeConfiguration<Bill>
{
    public void Configure(EntityTypeBuilder<Bill> b)
    {
        b.ToTable("bills");
        b.HasKey(e => e.Id);
        b.Property(e => e.Period).HasMaxLength(7).IsRequired();
        b.Property(e => e.Description).HasMaxLength(500).IsRequired();
        b.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.PaymentId).HasMaxLength(100);

        // Money value object — stored as two columns (paise + currency)
        b.OwnsOne(e => e.Amount, m =>
        {
            m.Property(p => p.Paise).HasColumnName("amount_paise").IsRequired();
            m.Property(p => p.Currency).HasColumnName("amount_currency").HasMaxLength(3).HasDefaultValue("INR");
        });
        b.OwnsOne(e => e.LateFee, m =>
        {
            m.Property(p => p.Paise).HasColumnName("late_fee_paise").HasDefaultValue(0L);
            m.Property(p => p.Currency).HasColumnName("late_fee_currency").HasMaxLength(3).HasDefaultValue("INR");
        });

        b.HasMany(e => e.Payments).WithOne().HasForeignKey(p => p.BillId);
        b.HasIndex(e => new { e.SocietyId, e.FlatId, e.Period }).IsUnique();
        b.HasIndex(e => new { e.SocietyId, e.Status });
        b.HasIndex(e => e.DueDate);
        b.HasQueryFilter(e => !e.IsDeleted);

        // Postgres RLS — tenant isolation
        b.ToTable(t => t.HasCheckConstraint("chk_bills_amount_positive", "amount_paise >= 0"));
    }
}
