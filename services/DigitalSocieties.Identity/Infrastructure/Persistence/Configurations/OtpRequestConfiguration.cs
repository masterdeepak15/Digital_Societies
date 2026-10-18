using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using DigitalSocieties.Identity.Domain.Entities;

namespace DigitalSocieties.Identity.Infrastructure.Persistence.Configurations;

public sealed class OtpRequestConfiguration : IEntityTypeConfiguration<OtpRequest>
{
    public void Configure(EntityTypeBuilder<OtpRequest> b)
    {
        b.ToTable("otp_requests");
        b.HasKey(e => e.Id);
        b.Property(e => e.Email).HasMaxLength(250).IsRequired();
        // Optimistic concurrency: two parallel redemptions of one code (or lost attempt
        // increments) must conflict instead of both succeeding.
        b.Property(e => e.IsUsed).IsConcurrencyToken();
        b.Property(e => e.Attempts).IsConcurrencyToken();
        b.Property(e => e.HashedOtp).HasMaxLength(100).IsRequired();
        b.Property(e => e.Purpose).HasMaxLength(20).IsRequired();
        b.HasIndex(e => new { e.Email, e.Purpose });
        b.HasIndex(e => e.ExpiresAt);   // for cleanup job
    }
}
