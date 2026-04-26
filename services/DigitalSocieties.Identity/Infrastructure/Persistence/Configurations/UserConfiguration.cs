using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using DigitalSocieties.Identity.Domain.Entities;

namespace DigitalSocieties.Identity.Infrastructure.Persistence.Configurations;

public sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> b)
    {
        b.ToTable("users");
        b.HasKey(e => e.Id);
        b.Property(e => e.Phone).HasMaxLength(20).IsRequired();
        b.Property(e => e.Name).HasMaxLength(200).IsRequired();
        b.Property(e => e.Email).HasMaxLength(250);
        b.Property(e => e.AvatarUrl).HasMaxLength(500);
        b.HasIndex(e => e.Phone).IsUnique();
        b.HasMany(e => e.Devices).WithOne().HasForeignKey(d => d.UserId);
        b.HasMany(e => e.Memberships).WithOne(m => m.User).HasForeignKey(m => m.UserId);
        b.HasQueryFilter(e => !e.IsDeleted);
    }
}
