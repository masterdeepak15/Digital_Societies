using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Parking.Domain.Entities;

namespace DigitalSocieties.Parking.Infrastructure.Persistence;

/// <summary>
/// EF Core context for the parking schema.
/// Multi-tenant: row-level security set at connection time by TenantResolutionMiddleware.
/// </summary>
public sealed class ParkingDbContext : DbContext
{
    public ParkingDbContext(DbContextOptions<ParkingDbContext> options) : base(options) { }

    public DbSet<ParkingLevel> ParkingLevels { get; set; } = null!;
    public DbSet<ParkingSlot>  ParkingSlots  { get; set; } = null!;
    public DbSet<Vehicle>      Vehicles      { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder m)
    {
        base.OnModelCreating(m);

        // ── Parking levels ─────────────────────────────────────────────────
        m.Entity<ParkingLevel>(e =>
        {
            e.ToTable("parking_levels", "parking");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            e.Property(x => x.SocietyId).HasColumnName("society_id");
            e.Property(x => x.Name).HasColumnName("name").HasMaxLength(100);
            e.Property(x => x.LevelNumber).HasColumnName("level_number");
            e.Property(x => x.FloorPlanUrl).HasColumnName("floor_plan_url").HasMaxLength(500);

            // Audit columns (from AuditableEntity)
            e.Property("IsDeleted").HasColumnName("is_deleted").HasDefaultValue(false);
            e.Property("CreatedAt").HasColumnName("created_at").HasDefaultValueSql("NOW()");
            e.Property("CreatedBy").HasColumnName("created_by");
            e.Property("UpdatedAt").HasColumnName("updated_at").HasDefaultValueSql("NOW()");
            e.Property("UpdatedBy").HasColumnName("updated_by");

            e.HasIndex(x => x.SocietyId).HasDatabaseName("ix_parking_levels_society_id");

            // One-to-many: level → slots (navigation)
            e.HasMany(l => l.Slots)
             .WithOne(s => s.Level!)
             .HasForeignKey(s => s.LevelId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        // ── Parking slots ──────────────────────────────────────────────────
        m.Entity<ParkingSlot>(e =>
        {
            e.ToTable("parking_slots", "parking");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            e.Property(x => x.SocietyId).HasColumnName("society_id");
            e.Property(x => x.LevelId).HasColumnName("level_id");
            e.Property(x => x.SlotNumber).HasColumnName("slot_number").HasMaxLength(20);
            e.Property(x => x.Type).HasColumnName("type").HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(30);
            e.Property(x => x.IsEvCharger).HasColumnName("is_ev_charger").HasDefaultValue(false);
            e.Property(x => x.AssignedFlatId).HasColumnName("assigned_flat_id");
            e.Property(x => x.VehicleNumber).HasColumnName("vehicle_number").HasMaxLength(20);
            e.Property(x => x.VehicleType).HasColumnName("vehicle_type").HasMaxLength(20);
            e.Property(x => x.VisitorPassId).HasColumnName("visitor_pass_id");
            e.Property(x => x.PassExpiresAt).HasColumnName("pass_expires_at");
            e.Property("IsDeleted").HasColumnName("is_deleted").HasDefaultValue(false);
            e.Property("CreatedAt").HasColumnName("created_at").HasDefaultValueSql("NOW()");
            e.Property("CreatedBy").HasColumnName("created_by");
            e.Property("UpdatedAt").HasColumnName("updated_at").HasDefaultValueSql("NOW()");
            e.Property("UpdatedBy").HasColumnName("updated_by");

            e.HasIndex(x => x.SocietyId).HasDatabaseName("ix_parking_slots_society_id");
            e.HasIndex(x => x.AssignedFlatId).HasDatabaseName("ix_parking_slots_flat_id");
            e.HasIndex(new[] { nameof(ParkingSlot.SocietyId), nameof(ParkingSlot.SlotNumber) })
             .HasDatabaseName("ix_parking_slots_society_slot_number")
             .IsUnique();
        });

        // ── Vehicles ───────────────────────────────────────────────────────
        m.Entity<Vehicle>(e =>
        {
            e.ToTable("vehicles", "parking");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            e.Property(x => x.SocietyId).HasColumnName("society_id");
            e.Property(x => x.FlatId).HasColumnName("flat_id");
            e.Property(x => x.RegistrationNumber).HasColumnName("registration_number").HasMaxLength(20);
            e.Property(x => x.Type).HasColumnName("type").HasMaxLength(20);
            e.Property(x => x.MakeModel).HasColumnName("make_model").HasMaxLength(100);
            e.Property(x => x.Color).HasColumnName("color").HasMaxLength(50);
            e.Property(x => x.IsActive).HasColumnName("is_active").HasDefaultValue(true);
            e.Property(x => x.RcDocumentUrl).HasColumnName("rc_document_url").HasMaxLength(500);
            e.Property("IsDeleted").HasColumnName("is_deleted").HasDefaultValue(false);
            e.Property("CreatedAt").HasColumnName("created_at").HasDefaultValueSql("NOW()");
            e.Property("CreatedBy").HasColumnName("created_by");
            e.Property("UpdatedAt").HasColumnName("updated_at").HasDefaultValueSql("NOW()");
            e.Property("UpdatedBy").HasColumnName("updated_by");

            e.HasIndex(x => x.SocietyId).HasDatabaseName("ix_vehicles_society_id");
            e.HasIndex(x => x.FlatId).HasDatabaseName("ix_vehicles_flat_id");
            e.HasIndex(new[] { nameof(Vehicle.SocietyId), nameof(Vehicle.RegistrationNumber) })
             .HasDatabaseName("ix_vehicles_reg_number").IsUnique();
        });
    }
}
