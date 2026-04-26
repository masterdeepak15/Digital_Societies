using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Facility.Domain.Entities;

namespace DigitalSocieties.Facility.Infrastructure.Persistence;

public sealed class FacilityDbContext : DbContext
{
    public FacilityDbContext(DbContextOptions<FacilityDbContext> options) : base(options) { }

    public DbSet<Facility.Domain.Entities.Facility>  Facilities => Set<Facility.Domain.Entities.Facility>();
    public DbSet<FacilityBooking> Bookings           => Set<FacilityBooking>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.HasDefaultSchema("facility");

        mb.Entity<Facility.Domain.Entities.Facility>(e =>
        {
            e.ToTable("facilities");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.SocietyId).HasColumnName("society_id").IsRequired();
            e.Property(x => x.Name).HasColumnName("name").HasMaxLength(200);
            e.Property(x => x.Description).HasColumnName("description").HasMaxLength(1000);
            e.Property(x => x.ImageUrl).HasColumnName("image_url").HasMaxLength(500);
            e.Property(x => x.CapacityPersons).HasColumnName("capacity_persons");
            e.Property(x => x.SlotDurationMinutes).HasColumnName("slot_duration_minutes");
            e.Property(x => x.OpenTime).HasColumnName("open_time");
            e.Property(x => x.CloseTime).HasColumnName("close_time");
            e.Property(x => x.IsActive).HasColumnName("is_active").HasDefaultValue(true);
            e.Property(x => x.AdvanceBookingDays).HasColumnName("advance_booking_days").HasDefaultValue(7);
            e.Property(x => x.MaxBookingsPerFlat).HasColumnName("max_bookings_per_flat").HasDefaultValue(2);
            e.Property(x => x.IsDeleted).HasColumnName("is_deleted").HasDefaultValue(false);
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.CreatedBy).HasColumnName("created_by");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            e.Property(x => x.UpdatedBy).HasColumnName("updated_by");
            e.HasIndex(x => x.SocietyId).HasDatabaseName("ix_facilities_society_id");
            e.Ignore(x => x.Bookings);
        });

        mb.Entity<FacilityBooking>(e =>
        {
            e.ToTable("facility_bookings");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.FacilityId).HasColumnName("facility_id").IsRequired();
            e.Property(x => x.SocietyId).HasColumnName("society_id").IsRequired();
            e.Property(x => x.FlatId).HasColumnName("flat_id").IsRequired();
            e.Property(x => x.BookedBy).HasColumnName("booked_by").IsRequired();
            e.Property(x => x.BookingDate).HasColumnName("booking_date");
            e.Property(x => x.StartTime).HasColumnName("start_time");
            e.Property(x => x.EndTime).HasColumnName("end_time");
            e.Property(x => x.Status).HasColumnName("status")
                .HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.CancelReason).HasColumnName("cancel_reason").HasMaxLength(500);
            e.Property(x => x.IsDeleted).HasColumnName("is_deleted").HasDefaultValue(false);
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.CreatedBy).HasColumnName("created_by");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            e.Property(x => x.UpdatedBy).HasColumnName("updated_by");

            e.HasOne<Facility.Domain.Entities.Facility>(b => b.Facility)
                .WithMany()
                .HasForeignKey(b => b.FacilityId);

            e.HasIndex(x => new { x.FacilityId, x.BookingDate, x.Status })
                .HasDatabaseName("ix_facility_bookings_facility_date_status");
        });
    }
}
