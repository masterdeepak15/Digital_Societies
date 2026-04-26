using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DigitalSocieties.Calling.Infrastructure.Persistence.Migrations;

public partial class InitialCreate : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.EnsureSchema(name: "calling");

        // ── Call rooms ─────────────────────────────────────────────────────
        migrationBuilder.CreateTable(
            name:   "call_rooms",
            schema: "calling",
            columns: table => new
            {
                id                 = table.Column<Guid>(nullable: false, defaultValueSql: "gen_random_uuid()"),
                society_id         = table.Column<Guid>(nullable: false),
                room_name          = table.Column<string>(maxLength: 120, nullable: false),
                type               = table.Column<string>(maxLength: 30, nullable: false),
                status             = table.Column<string>(maxLength: 30, nullable: false, defaultValue: "Waiting"),
                expires_at         = table.Column<DateTimeOffset>(nullable: false),
                linked_visitor_id  = table.Column<Guid>(nullable: true),
                initiator_flat_id  = table.Column<Guid>(nullable: true),
                is_deleted         = table.Column<bool>(nullable: false, defaultValue: false),
                created_at         = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
                created_by         = table.Column<Guid>(nullable: true),
                updated_at         = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
                updated_by         = table.Column<Guid>(nullable: true),
            },
            constraints: table => table.PrimaryKey("pk_call_rooms", x => x.id));

        migrationBuilder.CreateIndex("ix_call_rooms_society_id",
            "call_rooms", "society_id", schema: "calling");
        migrationBuilder.CreateIndex("ix_call_rooms_room_name",
            "call_rooms", "room_name", schema: "calling", unique: true);

        // ── Call participants ──────────────────────────────────────────────
        migrationBuilder.CreateTable(
            name:   "call_participants",
            schema: "calling",
            columns: table => new
            {
                id           = table.Column<Guid>(nullable: false, defaultValueSql: "gen_random_uuid()"),
                room_id      = table.Column<Guid>(nullable: false),
                user_id      = table.Column<Guid>(nullable: false),
                display_name = table.Column<string>(maxLength: 100, nullable: false),
                role         = table.Column<string>(maxLength: 20, nullable: false),
                joined_at    = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_call_participants", x => x.id);
                table.ForeignKey(
                    name:            "fk_call_participants_rooms",
                    column:          x => x.room_id,
                    principalSchema: "calling",
                    principalTable:  "call_rooms",
                    principalColumn: "id",
                    onDelete:        ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex("ix_call_participants_room_id",
            "call_participants", "room_id", schema: "calling");

        // ── Row-Level Security ─────────────────────────────────────────────
        migrationBuilder.Sql("ALTER TABLE calling.call_rooms ENABLE ROW LEVEL SECURITY;");
        migrationBuilder.Sql(@"
            CREATE POLICY society_isolation ON calling.call_rooms
                USING (society_id = current_setting('app.current_society_id', true)::uuid);");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("DROP POLICY IF EXISTS society_isolation ON calling.call_rooms;");
        migrationBuilder.DropTable(name: "call_participants", schema: "calling");
        migrationBuilder.DropTable(name: "call_rooms",        schema: "calling");
    }
}
