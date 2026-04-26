using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DigitalSocieties.Parking.Infrastructure.Persistence.Migrations;

/// <inheritdoc />
public partial class InitialCreate : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.EnsureSchema(name: "parking");

        // ── Parking levels ─────────────────────────────────────────────────
        migrationBuilder.CreateTable(
            name:   "parking_levels",
            schema: "parking",
            columns: table => new
            {
                id             = table.Column<Guid>(nullable: false, defaultValueSql: "gen_random_uuid()"),
                society_id     = table.Column<Guid>(nullable: false),
                name           = table.Column<string>(maxLength: 100, nullable: false),
                level_number   = table.Column<int>(nullable: false),
                floor_plan_url = table.Column<string>(maxLength: 500, nullable: true),
                is_deleted     = table.Column<bool>(nullable: false, defaultValue: false),
                created_at     = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
                created_by     = table.Column<Guid>(nullable: true),
                updated_at     = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
                updated_by     = table.Column<Guid>(nullable: true),
            },
            constraints: table => table.PrimaryKey("pk_parking_levels", x => x.id));

        migrationBuilder.CreateIndex("ix_parking_levels_society_id",
            "parking_levels", "society_id", schema: "parking");

        // ── Parking slots ──────────────────────────────────────────────────
        migrationBuilder.CreateTable(
            name:   "parking_slots",
            schema: "parking",
            columns: table => new
            {
                id               = table.Column<Guid>(nullable: false, defaultValueSql: "gen_random_uuid()"),
                society_id       = table.Column<Guid>(nullable: false),
                level_id         = table.Column<Guid>(nullable: false),
                slot_number      = table.Column<string>(maxLength: 20, nullable: false),
                type             = table.Column<string>(maxLength: 20, nullable: false),
                status           = table.Column<string>(maxLength: 30, nullable: false, defaultValue: "Available"),
                is_ev_charger    = table.Column<bool>(nullable: false, defaultValue: false),
                assigned_flat_id = table.Column<Guid>(nullable: true),
                vehicle_number   = table.Column<string>(maxLength: 20, nullable: true),
                vehicle_type     = table.Column<string>(maxLength: 20, nullable: true),
                visitor_pass_id  = table.Column<Guid>(nullable: true),
                pass_expires_at  = table.Column<DateTimeOffset>(nullable: true),
                is_deleted       = table.Column<bool>(nullable: false, defaultValue: false),
                created_at       = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
                created_by       = table.Column<Guid>(nullable: true),
                updated_at       = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
                updated_by       = table.Column<Guid>(nullable: true),
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_parking_slots", x => x.id);
                table.ForeignKey(
                    name:            "fk_parking_slots_levels",
                    column:          x => x.level_id,
                    principalSchema: "parking",
                    principalTable:  "parking_levels",
                    principalColumn: "id",
                    onDelete:        ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex("ix_parking_slots_society_id",
            "parking_slots", "society_id", schema: "parking");
        migrationBuilder.CreateIndex("ix_parking_slots_flat_id",
            "parking_slots", "assigned_flat_id", schema: "parking");
        migrationBuilder.CreateIndex("ix_parking_slots_society_slot_number",
            "parking_slots", ["society_id", "slot_number"], schema: "parking", unique: true);

        // ── Vehicles ───────────────────────────────────────────────────────
        migrationBuilder.CreateTable(
            name:   "vehicles",
            schema: "parking",
            columns: table => new
            {
                id                  = table.Column<Guid>(nullable: false, defaultValueSql: "gen_random_uuid()"),
                society_id          = table.Column<Guid>(nullable: false),
                flat_id             = table.Column<Guid>(nullable: false),
                registration_number = table.Column<string>(maxLength: 20, nullable: false),
                type                = table.Column<string>(maxLength: 20, nullable: false),
                make_model          = table.Column<string>(maxLength: 100, nullable: true),
                color               = table.Column<string>(maxLength: 50, nullable: true),
                is_active           = table.Column<bool>(nullable: false, defaultValue: true),
                rc_document_url     = table.Column<string>(maxLength: 500, nullable: true),
                is_deleted          = table.Column<bool>(nullable: false, defaultValue: false),
                created_at          = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
                created_by          = table.Column<Guid>(nullable: true),
                updated_at          = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
                updated_by          = table.Column<Guid>(nullable: true),
            },
            constraints: table => table.PrimaryKey("pk_vehicles", x => x.id));

        migrationBuilder.CreateIndex("ix_vehicles_society_id",
            "vehicles", "society_id", schema: "parking");
        migrationBuilder.CreateIndex("ix_vehicles_flat_id",
            "vehicles", "flat_id", schema: "parking");
        migrationBuilder.CreateIndex("ix_vehicles_reg_number",
            "vehicles", ["society_id", "registration_number"], schema: "parking", unique: true);

        // ── Row-Level Security ─────────────────────────────────────────────
        foreach (var table in new[] { "parking_levels", "parking_slots", "vehicles" })
        {
            migrationBuilder.Sql($"ALTER TABLE parking.{table} ENABLE ROW LEVEL SECURITY;");
            migrationBuilder.Sql($@"
                CREATE POLICY society_isolation ON parking.{table}
                    USING (society_id = current_setting('app.current_society_id', true)::uuid);");
        }
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        foreach (var table in new[] { "vehicles", "parking_slots", "parking_levels" })
        {
            migrationBuilder.Sql($"DROP POLICY IF EXISTS society_isolation ON parking.{table};");
        }
        migrationBuilder.DropTable(name: "vehicles",       schema: "parking");
        migrationBuilder.DropTable(name: "parking_slots",  schema: "parking");
        migrationBuilder.DropTable(name: "parking_levels", schema: "parking");
    }
}
