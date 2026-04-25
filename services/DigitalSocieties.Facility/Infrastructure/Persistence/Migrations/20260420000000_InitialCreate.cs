using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DigitalSocieties.Facility.Infrastructure.Persistence.Migrations;

/// <inheritdoc />
public partial class InitialCreate : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.EnsureSchema(name: "facility");

        // ── Facilities ─────────────────────────────────────────────────────────
        migrationBuilder.CreateTable(
            name:   "facilities",
            schema: "facility",
            columns: table => new
            {
                id                    = table.Column<Guid>(nullable: false, defaultValueSql: "gen_random_uuid()"),
                society_id            = table.Column<Guid>(nullable: false),
                name                  = table.Column<string>(maxLength: 150, nullable: false),
                description           = table.Column<string>(maxLength: 500, nullable: false),
                image_url             = table.Column<string>(maxLength: 500, nullable: true),
                capacity_persons      = table.Column<int>(nullable: false),
                slot_duration_minutes = table.Column<int>(nullable: false, defaultValue: 60),
                open_time             = table.Column<TimeOnly>(nullable: false),
                close_time            = table.Column<TimeOnly>(nullable: false),
                is_active             = table.Column<bool>(nullable: false, defaultValue: true),
                advance_booking_days  = table.Column<int>(nullable: false, defaultValue: 7),
                max_bookings_per_flat = table.Column<int>(nullable: false, defaultValue: 2),
                is_deleted            = table.Column<bool>(nullable: false, defaultValue: false),
                created_at            = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
                created_by            = table.Column<Guid>(nullable: true),
                updated_at            = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
                updated_by            = table.Column<Guid>(nullable: true),
            },
            constraints: table => table.PrimaryKey("pk_facilities", x => x.id));

        migrationBuilder.CreateIndex("ix_facilities_society_id",
            "facilities", "society_id", schema: "facility");

        // ── Facility bookings ──────────────────────────────────────────────────
        migrationBuilder.CreateTable(
            name:   "facility_bookings",
            schema: "facility",
            columns: table => new
            {
                id           = table.Column<Guid>(nullable: false, defaultValueSql: "gen_random_uuid()"),
                facility_id  = table.Column<Guid>(nullable: false),
                society_id   = table.Column<Guid>(nullable: false),
                booked_by    = table.Column<Guid>(nullable: false),   // user_id
                flat_id      = table.Column<Guid>(nullable: false),
                booking_date = table.Column<DateOnly>(nullable: false),
                start_time   = table.Column<TimeOnly>(nullable: false),
                end_time     = table.Column<TimeOnly>(nullable: false),
                status       = table.Column<string>(maxLength: 20, nullable: false, defaultValue: "Confirmed"),
                notes        = table.Column<string>(maxLength: 500, nullable: true),
                cancelled_at = table.Column<DateTimeOffset>(nullable: true),
                cancelled_by = table.Column<Guid>(nullable: true),
                is_deleted   = table.Column<bool>(nullable: false, defaultValue: false),
                created_at   = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
                created_by   = table.Column<Guid>(nullable: true),
                updated_at   = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
                updated_by   = table.Column<Guid>(nullable: true),
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_facility_bookings", x => x.id);
                table.ForeignKey(
                    name:       "fk_facility_bookings_facilities",
                    column:     x => x.facility_id,
                    principalSchema: "facility",
                    principalTable:  "facilities",
                    principalColumn: "id",
                    onDelete:   ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex("ix_facility_bookings_facility_id",
            "facility_bookings", "facility_id", schema: "facility");

        migrationBuilder.CreateIndex("ix_facility_bookings_society_date",
            "facility_bookings", ["society_id", "booking_date"], schema: "facility");

        migrationBuilder.CreateIndex("ix_facility_bookings_booked_by",
            "facility_bookings", "booked_by", schema: "facility");

        // ── Row-Level Security ─────────────────────────────────────────────────
        migrationBuilder.Sql(
            "ALTER TABLE facility.facilities ENABLE ROW LEVEL SECURITY;");

        migrationBuilder.Sql(@"
            CREATE POLICY society_isolation ON facility.facilities
                USING (society_id = current_setting('app.current_society_id', true)::uuid);");

        migrationBuilder.Sql(
            "ALTER TABLE facility.facility_bookings ENABLE ROW LEVEL SECURITY;");

        migrationBuilder.Sql(@"
            CREATE POLICY society_isolation ON facility.facility_bookings
                USING (society_id = current_setting('app.current_society_id', true)::uuid);");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("DROP POLICY IF EXISTS society_isolation ON facility.facility_bookings;");
        migrationBuilder.Sql("DROP POLICY IF EXISTS society_isolation ON facility.facilities;");
        migrationBuilder.DropTable(name: "facility_bookings", schema: "facility");
        migrationBuilder.DropTable(name: "facilities", schema: "facility");
    }
}
