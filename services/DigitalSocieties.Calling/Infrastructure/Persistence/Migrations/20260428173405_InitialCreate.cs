using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DigitalSocieties.Calling.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "calling");

            migrationBuilder.CreateTable(
                name: "call_rooms",
                schema: "calling",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    society_id = table.Column<Guid>(type: "uuid", nullable: false),
                    room_name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    linked_visitor_id = table.Column<Guid>(type: "uuid", nullable: true),
                    initiator_flat_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_call_rooms", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "call_participants",
                schema: "calling",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    room_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    display_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    role = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    joined_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_call_participants", x => x.id);
                    table.ForeignKey(
                        name: "FK_call_participants_call_rooms_room_id",
                        column: x => x.room_id,
                        principalSchema: "calling",
                        principalTable: "call_rooms",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_call_participants_room_id",
                schema: "calling",
                table: "call_participants",
                column: "room_id");

            migrationBuilder.CreateIndex(
                name: "ix_call_rooms_room_name",
                schema: "calling",
                table: "call_rooms",
                column: "room_name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_call_rooms_society_id",
                schema: "calling",
                table: "call_rooms",
                column: "society_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "call_participants",
                schema: "calling");

            migrationBuilder.DropTable(
                name: "call_rooms",
                schema: "calling");
        }
    }
}
