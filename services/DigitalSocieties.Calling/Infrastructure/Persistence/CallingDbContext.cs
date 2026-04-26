using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Calling.Domain.Entities;

namespace DigitalSocieties.Calling.Infrastructure.Persistence;

public sealed class CallingDbContext : DbContext
{
    public CallingDbContext(DbContextOptions<CallingDbContext> options) : base(options) { }

    public DbSet<CallRoom>        CallRooms        { get; set; } = null!;
    public DbSet<CallParticipant> CallParticipants { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder m)
    {
        base.OnModelCreating(m);

        m.Entity<CallRoom>(e =>
        {
            e.ToTable("call_rooms", "calling");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            e.Property(x => x.SocietyId).HasColumnName("society_id");
            e.Property(x => x.RoomName).HasColumnName("room_name").HasMaxLength(120);
            e.Property(x => x.Type).HasColumnName("type").HasConversion<string>().HasMaxLength(30);
            e.Property(x => x.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(30);
            e.Property(x => x.ExpiresAt).HasColumnName("expires_at");
            e.Property(x => x.LinkedVisitorId).HasColumnName("linked_visitor_id");
            e.Property(x => x.InitiatorFlatId).HasColumnName("initiator_flat_id");
            e.Property("IsDeleted").HasColumnName("is_deleted").HasDefaultValue(false);
            e.Property("CreatedAt").HasColumnName("created_at").HasDefaultValueSql("NOW()");
            e.Property("CreatedBy").HasColumnName("created_by");
            e.Property("UpdatedAt").HasColumnName("updated_at").HasDefaultValueSql("NOW()");
            e.Property("UpdatedBy").HasColumnName("updated_by");

            e.HasMany(r => r.Participants)
             .WithOne()
             .HasForeignKey(p => p.RoomId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(x => x.SocietyId).HasDatabaseName("ix_call_rooms_society_id");
            e.HasIndex(x => x.RoomName).HasDatabaseName("ix_call_rooms_room_name").IsUnique();
        });

        m.Entity<CallParticipant>(e =>
        {
            e.ToTable("call_participants", "calling");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            e.Property(x => x.RoomId).HasColumnName("room_id");
            e.Property(x => x.UserId).HasColumnName("user_id");
            e.Property(x => x.DisplayName).HasColumnName("display_name").HasMaxLength(100);
            e.Property(x => x.Role).HasColumnName("role").HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.JoinedAt).HasColumnName("joined_at");
        });
    }
}
