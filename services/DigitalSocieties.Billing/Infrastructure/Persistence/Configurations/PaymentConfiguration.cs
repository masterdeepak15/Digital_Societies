using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using DigitalSocieties.Billing.Domain.Entities;

namespace DigitalSocieties.Billing.Infrastructure.Persistence.Configurations;

public sealed class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> b)
    {
        b.ToTable("payments");
        b.HasKey(e => e.Id);
        b.Property(e => e.Gateway).HasMaxLength(30).IsRequired();
        b.Property(e => e.GatewayOrderId).HasMaxLength(100);
        b.Property(e => e.GatewayPaymentId).HasMaxLength(100);
        b.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
        b.OwnsOne(e => e.Amount, m =>
        {
            m.Property(p => p.Paise).HasColumnName("amount_paise");
            m.Property(p => p.Currency).HasColumnName("amount_currency").HasMaxLength(3).HasDefaultValue("INR");
        });
        b.HasIndex(e => e.GatewayPaymentId).IsUnique();
        b.HasIndex(e => e.GatewayOrderId);
    }
}
