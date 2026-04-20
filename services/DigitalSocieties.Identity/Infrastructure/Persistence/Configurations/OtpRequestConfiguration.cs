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
        b.Property(e => e.Phone).HasMaxLength(20).IsRequired();
        b.Property(e => e.HashedOtp).HasMaxLength(100).IsRequired();
        b.Property(e => e.Purpose).HasMaxLength(20).IsRequired();
        b.HasIndex(e => new { e.Phone, e.Purpose });
        b.HasIndex(e => e.ExpiresAt);   // for cleanup job
    }
}
