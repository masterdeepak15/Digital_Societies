using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using DigitalSocieties.Identity.Domain.Entities;

namespace DigitalSocieties.Identity.Infrastructure.Persistence.Configurations;

public sealed class MembershipConfiguration : IEntityTypeConfiguration<Membership>
{
    public void Configure(EntityTypeBuilder<Membership> b)
    {
        b.ToTable("memberships");
        b.HasKey(e => e.Id);
        b.Property(e => e.Role).HasMaxLength(30).IsRequired();
        b.Property(e => e.MemberType).HasMaxLength(20).IsRequired();
        // A user can have one active role per society (multiple roles → multiple membership rows)
        b.HasIndex(e => new { e.UserId, e.SocietyId, e.Role }).IsUnique();
        b.HasOne(e => e.Society).WithMany().HasForeignKey(e => e.SocietyId);
        b.HasOne(e => e.Flat).WithMany(f => f.Memberships).HasForeignKey(e => e.FlatId);
        b.HasQueryFilter(e => !e.IsDeleted);
    }
}
