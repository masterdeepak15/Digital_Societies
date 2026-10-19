using Microsoft.EntityFrameworkCore;
using DigitalSocieties.Marketplace.Domain.Entities;

namespace DigitalSocieties.Marketplace.Infrastructure.Persistence;

public sealed class MarketplaceDbContext : DbContext
{
    public MarketplaceDbContext(DbContextOptions<MarketplaceDbContext> options) : base(options) { }

    public DbSet<ServiceListing> ServiceListings { get; set; } = null!;
    public DbSet<ServiceBooking> ServiceBookings { get; set; } = null!;
    public DbSet<ServiceReview>  ServiceReviews  { get; set; } = null!;
    public DbSet<MarketPost>     MarketPosts     { get; set; } = null!;
    public DbSet<MarketReply>    MarketReplies   { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder m)
    {
        base.OnModelCreating(m);

        m.Entity<ServiceListing>(e =>
        {
            e.ToTable("service_listings", "marketplace");
            e.HasKey(x => x.Id);
            e.HasQueryFilter(x => !x.IsDeleted);
            e.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            e.Property(x => x.SocietyId).HasColumnName("society_id");
            e.Property(x => x.ProviderId).HasColumnName("provider_id");
            e.Property(x => x.ProviderName).HasColumnName("provider_name").HasMaxLength(120);
            e.Property(x => x.Phone).HasColumnName("phone").HasMaxLength(20);
            e.Property(x => x.Category).HasColumnName("category").HasConversion<string>().HasMaxLength(30);
            e.Property(x => x.Title).HasColumnName("title").HasMaxLength(200);
            e.Property(x => x.Description).HasColumnName("description").HasMaxLength(2000);
            e.Property(x => x.ProfilePhotoUrl).HasColumnName("profile_photo_url").HasMaxLength(500);
            e.Property(x => x.RateUnit).HasColumnName("rate_unit").HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.CommissionPct).HasColumnName("commission_pct").HasPrecision(5, 2);
            e.Property(x => x.AverageRating).HasColumnName("average_rating");
            e.Property(x => x.ReviewCount).HasColumnName("review_count");
            e.Property(x => x.IsActive).HasColumnName("is_active").HasDefaultValue(true);
            // No database default here: the first value (Pending) is the CLR default, and EF would leave the column out of the INSERT
            // and let a database default turn every new resident registration into "Approved".
            e.Property(x => x.Approval).HasColumnName("approval").HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.RejectionReason).HasColumnName("rejection_reason").HasMaxLength(500);
            e.Property("IsDeleted").HasColumnName("is_deleted").HasDefaultValue(false);
            e.Property("CreatedAt").HasColumnName("created_at").HasDefaultValueSql("NOW()");
            e.Property("CreatedBy").HasColumnName("created_by");
            e.Property("UpdatedAt").HasColumnName("updated_at").HasDefaultValueSql("NOW()");
            e.Property("UpdatedBy").HasColumnName("updated_by");

            // Money owned entity — map Paise (long) not Amount (computed decimal)
            e.OwnsOne(x => x.BaseRate, br =>
            {
                br.Property(m => m.Paise).HasColumnName("base_rate_paise");
                br.Property(m => m.Currency).HasColumnName("base_rate_currency").HasMaxLength(3);
                br.Ignore(m => m.Amount);
            });

            e.HasIndex(x => x.SocietyId).HasDatabaseName("ix_service_listings_society_id");
            e.HasIndex(x => x.ProviderId).HasDatabaseName("ix_service_listings_provider_id");

            e.HasMany(l => l.Bookings)
             .WithOne(b => b.Listing!)
             .HasForeignKey(b => b.ListingId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        m.Entity<ServiceBooking>(e =>
        {
            e.ToTable("service_bookings", "marketplace");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            e.Property(x => x.SocietyId).HasColumnName("society_id");
            e.Property(x => x.ListingId).HasColumnName("listing_id");
            e.Property(x => x.ResidentId).HasColumnName("resident_id");
            e.Property(x => x.FlatId).HasColumnName("flat_id");
            e.Property(x => x.ScheduledAt).HasColumnName("scheduled_at");
            e.Property(x => x.Notes).HasColumnName("notes").HasMaxLength(1000);
            e.Property(x => x.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.ConfirmedAt).HasColumnName("confirmed_at");
            e.Property(x => x.CompletedAt).HasColumnName("completed_at");
            e.Property(x => x.CancelledAt).HasColumnName("cancelled_at");
            e.Property(x => x.CancelReason).HasColumnName("cancel_reason").HasMaxLength(500);
            e.Property("IsDeleted").HasColumnName("is_deleted").HasDefaultValue(false);
            e.Property("CreatedAt").HasColumnName("created_at").HasDefaultValueSql("NOW()");
            e.Property("CreatedBy").HasColumnName("created_by");
            e.Property("UpdatedAt").HasColumnName("updated_at").HasDefaultValueSql("NOW()");
            e.Property("UpdatedBy").HasColumnName("updated_by");

            e.OwnsOne(x => x.QuotedAmount, q =>
            {
                q.Property(m => m.Paise).HasColumnName("quoted_paise");
                q.Property(m => m.Currency).HasColumnName("quoted_currency").HasMaxLength(3);
                q.Ignore(m => m.Amount);
            });
            e.OwnsOne(x => x.FinalAmount, f =>
            {
                f.Property(m => m.Paise).HasColumnName("final_paise");
                f.Property(m => m.Currency).HasColumnName("final_currency").HasMaxLength(3);
                f.Ignore(m => m.Amount);
            });

            e.HasIndex(x => x.SocietyId).HasDatabaseName("ix_service_bookings_society_id");
            e.HasIndex(x => x.ResidentId).HasDatabaseName("ix_service_bookings_resident_id");

            e.HasOne(b => b.Review)
             .WithOne()
             .HasForeignKey<ServiceReview>(r => r.BookingId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // The society market: sell / wanted / borrow posts and the public replies under them.
        m.Entity<MarketPost>(e =>
        {
            e.ToTable("market_posts", "marketplace");
            e.HasKey(x => x.Id);
            e.HasQueryFilter(x => !x.IsDeleted);
            e.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            e.Property(x => x.SocietyId).HasColumnName("society_id");
            e.Property(x => x.AuthorUserId).HasColumnName("author_user_id");
            e.Property(x => x.AuthorFlatId).HasColumnName("author_flat_id");
            e.Property(x => x.Kind).HasColumnName("kind").HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Title).HasColumnName("title").HasMaxLength(120);
            e.Property(x => x.Description).HasColumnName("description").HasMaxLength(1000);
            e.Property(x => x.PricePaise).HasColumnName("price_paise");
            e.Property(x => x.Condition).HasColumnName("condition").HasMaxLength(30);
            e.Property(x => x.ImageIds).HasColumnName("image_ids");
            e.Property(x => x.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.ClosedWithUserId).HasColumnName("closed_with_user_id");
            e.Property(x => x.ClosedAt).HasColumnName("closed_at");
            e.Property("IsDeleted").HasColumnName("is_deleted").HasDefaultValue(false);
            e.Property("CreatedAt").HasColumnName("created_at").HasDefaultValueSql("NOW()");
            e.Property("CreatedBy").HasColumnName("created_by");
            e.Property("UpdatedAt").HasColumnName("updated_at").HasDefaultValueSql("NOW()");
            e.Property("UpdatedBy").HasColumnName("updated_by");
            e.HasIndex(x => new { x.SocietyId, x.Status }).HasDatabaseName("ix_market_posts_society_status");
            e.HasIndex(x => x.AuthorUserId).HasDatabaseName("ix_market_posts_author");
        });

        m.Entity<MarketReply>(e =>
        {
            e.ToTable("market_replies", "marketplace");
            e.HasKey(x => x.Id);
            e.HasQueryFilter(x => !x.IsDeleted);
            e.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            e.Property(x => x.SocietyId).HasColumnName("society_id");
            e.Property(x => x.PostId).HasColumnName("post_id");
            e.Property(x => x.AuthorUserId).HasColumnName("author_user_id");
            e.Property(x => x.AuthorFlatId).HasColumnName("author_flat_id");
            e.Property(x => x.Body).HasColumnName("body").HasMaxLength(1000);
            e.Property("IsDeleted").HasColumnName("is_deleted").HasDefaultValue(false);
            e.Property("CreatedAt").HasColumnName("created_at").HasDefaultValueSql("NOW()");
            e.Property("CreatedBy").HasColumnName("created_by");
            e.Property("UpdatedAt").HasColumnName("updated_at").HasDefaultValueSql("NOW()");
            e.Property("UpdatedBy").HasColumnName("updated_by");
            e.HasIndex(x => x.PostId).HasDatabaseName("ix_market_replies_post");
        });

        m.Entity<ServiceReview>(e =>
        {
            e.ToTable("service_reviews", "marketplace");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            e.Property(x => x.SocietyId).HasColumnName("society_id");
            e.Property(x => x.BookingId).HasColumnName("booking_id");
            e.Property(x => x.ListingId).HasColumnName("listing_id");
            e.Property(x => x.ReviewerId).HasColumnName("reviewer_id");
            e.Property(x => x.Rating).HasColumnName("rating");
            e.Property(x => x.Comment).HasColumnName("comment").HasMaxLength(1000);
            e.Property("IsDeleted").HasColumnName("is_deleted").HasDefaultValue(false);
            e.Property("CreatedAt").HasColumnName("created_at").HasDefaultValueSql("NOW()");
            e.Property("CreatedBy").HasColumnName("created_by");
            e.Property("UpdatedAt").HasColumnName("updated_at").HasDefaultValueSql("NOW()");
            e.Property("UpdatedBy").HasColumnName("updated_by");

            e.HasIndex(x => x.BookingId).HasDatabaseName("ix_service_reviews_booking_id").IsUnique();
            e.HasIndex(x => x.ListingId).HasDatabaseName("ix_service_reviews_listing_id");
        });
    }
}
