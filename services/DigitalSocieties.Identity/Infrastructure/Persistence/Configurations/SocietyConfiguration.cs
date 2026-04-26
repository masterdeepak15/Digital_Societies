using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using DigitalSocieties.Identity.Domain.Entities;

namespace DigitalSocieties.Identity.Infrastructure.Persistence.Configurations;

public sealed class SocietyConfiguration : IEntityTypeConfiguration<Society>
{
    public void Configure(EntityTypeBuilder<Society> b)
    {
        b.ToTable("societies");
        b.HasKey(e => e.Id);
        b.Property(e => e.Name).HasMaxLength(200).IsRequired();
        b.Property(e => e.Address).HasMaxLength(500).IsRequired();
        b.Property(e => e.RegistrationNumber).HasMaxLength(100).IsRequired();
        b.Property(e => e.Tier).HasMaxLength(20).HasDefaultValue("free");
        b.Property(e => e.LogoUrl).HasMaxLength(500);
        b.HasIndex(e => e.RegistrationNumber).IsUnique();
        b.HasMany(e => e.Flats).WithOne().HasForeignKey(f => f.SocietyId);
        // Soft-delete filter
        b.HasQueryFilter(e => !e.IsDeleted);
    }
}
