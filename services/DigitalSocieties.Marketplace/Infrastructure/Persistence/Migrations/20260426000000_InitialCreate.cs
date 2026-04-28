using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DigitalSocieties.Marketplace.Infrastructure.Persistence.Migrations;

public partial class InitialCreate : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.EnsureSchema(name: "marketplace");

        migrationBuilder.CreateTable(
            name: "service_listings", schema: "marketplace",
            columns: table => new
            {
                id                = table.Column<Guid>(nullable: false, defaultValueSql: "gen_random_uuid()"),
                society_id        = table.Column<Guid>(nullable: false),
                provider_id       = table.Column<Guid>(nullable: false),
                provider_name     = table.Column<string>(maxLength: 120, nullable: false),
                phone             = table.Column<string>(maxLength: 20, nullable: false),
                category          = table.Column<string>(maxLength: 30, nullable: false),
                title             = table.Column<string>(maxLength: 200, nullable: false),
                description       = table.Column<string>(maxLength: 2000, nullable: false),
                profile_photo_url = table.Column<string>(maxLength: 500, nullable: true),
                base_rate_paise   = table.Column<long>(nullable: false, defaultValue: 0L),
                base_rate_currency = table.Column<string>(maxLength: 3, nullable: false, defaultValue: "INR"),
                rate_unit         = table.Column<string>(maxLength: 20, nullable: false),
                commission_pct    = table.Column<decimal>(precision: 5, scale: 2, nullable: false, defaultValue: 10m),
                average_rating    = table.Column<float>(nullable: false, defaultValue: 0f),
                review_count      = table.Column<int>(nullable: false, defaultValue: 0),
                is_active         = table.Column<bool>(nullable: false, defaultValue: true),
                is_deleted        = table.Column<bool>(nullable: false, defaultValue: false),
                created_at        = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
                created_by        = table.Column<Guid>(nullable: true),
                updated_at        = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
                updated_by        = table.Column<Guid>(nullable: true),
            },
            constraints: table => table.PrimaryKey("pk_service_listings", x => x.id));

        migrationBuilder.CreateIndex("ix_service_listings_society_id",
            "service_listings", "society_id", schema: "marketplace");
        migrationBuilder.CreateIndex("ix_service_listings_provider_id",
            "service_listings", "provider_id", schema: "marketplace");

        migrationBuilder.CreateTable(
            name: "service_bookings", schema: "marketplace",
            columns: table => new
            {
                id               = table.Column<Guid>(nullable: false, defaultValueSql: "gen_random_uuid()"),
                society_id       = table.Column<Guid>(nullable: false),
                listing_id       = table.Column<Guid>(nullable: false),
                resident_id      = table.Column<Guid>(nullable: false),
                flat_id          = table.Column<Guid>(nullable: false),
                scheduled_at     = table.Column<DateTimeOffset>(nullable: false),
                notes            = table.Column<string>(maxLength: 1000, nullable: true),
                status           = table.Column<string>(maxLength: 20, nullable: false, defaultValue: "Pending"),
                quoted_paise     = table.Column<long>(nullable: false, defaultValue: 0L),
                quoted_currency  = table.Column<string>(maxLength: 3, nullable: false, defaultValue: "INR"),
                final_paise      = table.Column<long>(nullable: true),
                final_currency   = table.Column<string>(maxLength: 3, nullable: true),
                confirmed_at     = table.Column<DateTimeOffset>(nullable: true),
                completed_at     = table.Column<DateTimeOffset>(nullable: true),
                cancelled_at     = table.Column<DateTimeOffset>(nullable: true),
                cancel_reason    = table.Column<string>(maxLength: 500, nullable: true),
                is_deleted       = table.Column<bool>(nullable: false, defaultValue: false),
                created_at       = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
                created_by       = table.Column<Guid>(nullable: true),
                updated_at       = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
                updated_by       = table.Column<Guid>(nullable: true),
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_service_bookings", x => x.id);
                table.ForeignKey("fk_service_bookings_listings",
                    x => x.listing_id, "marketplace", "service_listings", "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex("ix_service_bookings_society_id",
            "service_bookings", "society_id", schema: "marketplace");
        migrationBuilder.CreateIndex("ix_service_bookings_resident_id",
            "service_bookings", "resident_id", schema: "marketplace");

        migrationBuilder.CreateTable(
            name: "service_reviews", schema: "marketplace",
            columns: table => new
            {
                id          = table.Column<Guid>(nullable: false, defaultValueSql: "gen_random_uuid()"),
                society_id  = table.Column<Guid>(nullable: false),
                booking_id  = table.Column<Guid>(nullable: false),
                listing_id  = table.Column<Guid>(nullable: false),
                reviewer_id = table.Column<Guid>(nullable: false),
                rating      = table.Column<int>(nullable: false),
                comment     = table.Column<string>(maxLength: 1000, nullable: false),
                is_deleted  = table.Column<bool>(nullable: false, defaultValue: false),
                created_at  = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
                created_by  = table.Column<Guid>(nullable: true),
                updated_at  = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
                updated_by  = table.Column<Guid>(nullable: true),
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_service_reviews", x => x.id);
                table.ForeignKey("fk_service_reviews_bookings",
                    x => x.booking_id, "marketplace", "service_bookings", "id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex("ix_service_reviews_booking_id",
            "service_reviews", "booking_id", schema: "marketplace", unique: true);
        migrationBuilder.CreateIndex("ix_service_reviews_listing_id",
            "service_reviews", "listing_id", schema: "marketplace");

        // ── Row-Level Security ─────────────────────────────────────────────
        foreach (var tbl in new[] { "service_listings", "service_bookings", "service_reviews" })
        {
            migrationBuilder.Sql($"ALTER TABLE marketplace.{tbl} ENABLE ROW LEVEL SECURITY;");
            migrationBuilder.Sql($@"
                CREATE POLICY society_isolation ON marketplace.{tbl}
                    USING (society_id = current_setting('app.current_society_id', true)::uuid);");
        }
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        foreach (var tbl in new[] { "service_reviews", "service_bookings", "service_listings" })
            migrationBuilder.Sql($"DROP POLICY IF EXISTS society_isolation ON marketplace.{tbl};");

        migrationBuilder.DropTable("service_reviews", "marketplace");
        migrationBuilder.DropTable("service_bookings", "marketplace");
        migrationBuilder.DropTable("service_listings", "marketplace");
    }
}
