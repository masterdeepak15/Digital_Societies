using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using DigitalSocieties.Identity.Infrastructure.Security;

namespace DigitalSocieties.Identity.Infrastructure.Persistence.Configurations;

public sealed class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshTokenRecord>
{
    public void Configure(EntityTypeBuilder<RefreshTokenRecord> b)
    {
        b.ToTable("refresh_tokens");
        b.HasKey(e => e.Id);
        b.Property(e => e.Token).HasMaxLength(200).IsRequired();
        b.HasIndex(e => e.Token).IsUnique();
        b.HasIndex(e => e.ExpiresAt);
        b.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId);
    }
}
