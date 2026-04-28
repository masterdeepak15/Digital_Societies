using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DigitalSocieties.Parking.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "parking");

            migrationBuilder.CreateTable(
                name: "parking_levels",
                schema: "parking",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    society_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    level_number = table.Column<int>(type: "integer", nullable: false),
                    floor_plan_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_parking_levels", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "vehicles",
                schema: "parking",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    society_id = table.Column<Guid>(type: "uuid", nullable: false),
                    flat_id = table.Column<Guid>(type: "uuid", nullable: false),
                    registration_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    make_model = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    color = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    rc_document_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_vehicles", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "parking_slots",
                schema: "parking",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    society_id = table.Column<Guid>(type: "uuid", nullable: false),
                    level_id = table.Column<Guid>(type: "uuid", nullable: false),
                    slot_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    is_ev_charger = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    assigned_flat_id = table.Column<Guid>(type: "uuid", nullable: true),
                    vehicle_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    vehicle_type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    visitor_pass_id = table.Column<Guid>(type: "uuid", nullable: true),
                    pass_expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_parking_slots", x => x.id);
                    table.ForeignKey(
                        name: "FK_parking_slots_parking_levels_level_id",
                        column: x => x.level_id,
                        principalSchema: "parking",
                        principalTable: "parking_levels",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_parking_levels_society_id",
                schema: "parking",
                table: "parking_levels",
                column: "society_id");

            migrationBuilder.CreateIndex(
                name: "ix_parking_slots_flat_id",
                schema: "parking",
                table: "parking_slots",
                column: "assigned_flat_id");

            migrationBuilder.CreateIndex(
                name: "IX_parking_slots_level_id",
                schema: "parking",
                table: "parking_slots",
                column: "level_id");

            migrationBuilder.CreateIndex(
                name: "ix_parking_slots_society_id",
                schema: "parking",
                table: "parking_slots",
                column: "society_id");

            migrationBuilder.CreateIndex(
                name: "ix_parking_slots_society_slot_number",
                schema: "parking",
                table: "parking_slots",
                columns: new[] { "society_id", "slot_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_vehicles_flat_id",
                schema: "parking",
                table: "vehicles",
                column: "flat_id");

            migrationBuilder.CreateIndex(
                name: "ix_vehicles_reg_number",
                schema: "parking",
                table: "vehicles",
                columns: new[] { "society_id", "registration_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_vehicles_society_id",
                schema: "parking",
                table: "vehicles",
                column: "society_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "parking_slots",
                schema: "parking");

            migrationBuilder.DropTable(
                name: "vehicles",
                schema: "parking");

            migrationBuilder.DropTable(
                name: "parking_levels",
                schema: "parking");
        }
    }
}
