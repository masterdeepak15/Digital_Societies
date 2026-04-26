using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DigitalSocieties.Identity.Infrastructure.Persistence.Migrations;

/// <inheritdoc />
public partial class InitialCreate : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.EnsureSchema(name: "identity");

        // ── Societies ─────────────────────────────────────────────────────────
        migrationBuilder.CreateTable(
            name:   "societies",
            schema: "identity",
            columns: table => new
            {
                id                  = table.Column<Guid>(nullable: false, defaultValueSql: "gen_random_uuid()"),
                name                = table.Column<string>(maxLength: 200, nullable: false),
                address             = table.Column<string>(maxLength: 500, nullable: false),
                registration_number = table.Column<string>(maxLength: 100, nullable: false),
                tier                = table.Column<string>(maxLength: 20,  nullable: false, defaultValue: "free"),
                is_active           = table.Column<bool>(nullable: false, defaultValue: true),
                logo_url            = table.Column<string>(maxLength: 500, nullable: true),
                primary_phone       = table.Column<string>(maxLength: 20,  nullable: true),
                primary_email       = table.Column<string>(maxLength: 250, nullable: true),
                total_flats         = table.Column<int>(nullable: false, defaultValue: 0),
                is_deleted          = table.Column<bool>(nullable: false, defaultValue: false),
                created_at          = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
                created_by          = table.Column<Guid>(nullable: true),
                updated_at          = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
                updated_by          = table.Column<Guid>(nullable: true),
            },
            constraints: table => table.PrimaryKey("pk_societies", x => x.id));

        migrationBuilder.CreateIndex("ix_societies_reg_number", "societies", "registration_number",
            schema: "identity", unique: true);

        // ── Users ─────────────────────────────────────────────────────────────
        migrationBuilder.CreateTable(
            name:   "users",
            schema: "identity",
            columns: table => new
            {
                id            = table.Column<Guid>(nullable: false, defaultValueSql: "gen_random_uuid()"),
                phone         = table.Column<string>(maxLength: 20,  nullable: false),
                name          = table.Column<string>(maxLength: 200, nullable: false),
                email         = table.Column<string>(maxLength: 250, nullable: true),
                avatar_url    = table.Column<string>(maxLength: 500, nullable: true),
                is_verified   = table.Column<bool>(nullable: false, defaultValue: false),
                is_active     = table.Column<bool>(nullable: false, defaultValue: true),
                is_deleted    = table.Column<bool>(nullable: false, defaultValue: false),
                last_login_at = table.Column<DateTimeOffset>(nullable: true),
                created_at    = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
                created_by    = table.Column<Guid>(nullable: true),
                updated_at    = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
                updated_by    = table.Column<Guid>(nullable: true),
            },
            constraints: table => table.PrimaryKey("pk_users", x => x.id));

        migrationBuilder.CreateIndex("ix_users_phone", "users", "phone", schema: "identity", unique: true);

        // ── Flats ─────────────────────────────────────────────────────────────
        migrationBuilder.CreateTable(
            name:   "flats",
            schema: "identity",
            columns: table => new
            {
                id          = table.Column<Guid>(nullable: false, defaultValueSql: "gen_random_uuid()"),
                society_id  = table.Column<Guid>(nullable: false),
                number      = table.Column<string>(maxLength: 20, nullable: false),
                wing        = table.Column<string>(maxLength: 10, nullable: false),
                floor       = table.Column<int>(nullable: false),
                owner_phone = table.Column<string>(maxLength: 20, nullable: true),
                is_occupied = table.Column<bool>(nullable: false, defaultValue: false),
                is_deleted  = table.Column<bool>(nullable: false, defaultValue: false),
                created_at  = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
                created_by  = table.Column<Guid>(nullable: true),
                updated_at  = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
                updated_by  = table.Column<Guid>(nullable: true),
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_flats", x => x.id);
                table.ForeignKey("fk_flats_societies", x => x.society_id,
                    principalSchema: "identity", principalTable: "societies",
                    principalColumn: "id", onDelete: ReferentialAction.Cascade);
            });

        // ── Memberships ───────────────────────────────────────────────────────
        migrationBuilder.CreateTable(
            name:   "memberships",
            schema: "identity",
            columns: table => new
            {
                id          = table.Column<Guid>(nullable: false, defaultValueSql: "gen_random_uuid()"),
                user_id     = table.Column<Guid>(nullable: false),
                society_id  = table.Column<Guid>(nullable: false),
                flat_id     = table.Column<Guid>(nullable: true),
                role        = table.Column<string>(maxLength: 30, nullable: false),
                member_type = table.Column<string>(maxLength: 20, nullable: false, defaultValue: "owner"),
                is_active   = table.Column<bool>(nullable: false, defaultValue: true),
                joined_at   = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
                expires_at  = table.Column<DateTimeOffset>(nullable: true),
                is_deleted  = table.Column<bool>(nullable: false, defaultValue: false),
                created_at  = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
                created_by  = table.Column<Guid>(nullable: true),
                updated_at  = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
                updated_by  = table.Column<Guid>(nullable: true),
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_memberships", x => x.id);
                table.ForeignKey("fk_memberships_users",     x => x.user_id,    "identity", "users",    "id");
                table.ForeignKey("fk_memberships_societies", x => x.society_id, "identity", "societies","id");
                table.ForeignKey("fk_memberships_flats",     x => x.flat_id,    "identity", "flats",    "id");
            });

        migrationBuilder.CreateIndex("ix_memberships_user_society_role", "memberships",
            ["user_id","society_id","role"], schema: "identity", unique: true);

        // ── OTP Requests ──────────────────────────────────────────────────────
        migrationBuilder.CreateTable(
            name:   "otp_requests",
            schema: "identity",
            columns: table => new
            {
                id         = table.Column<Guid>(nullable: false, defaultValueSql: "gen_random_uuid()"),
                phone      = table.Column<string>(maxLength: 20,  nullable: false),
                hashed_otp = table.Column<string>(maxLength: 100, nullable: false),
                purpose    = table.Column<string>(maxLength: 20,  nullable: false),
                is_used    = table.Column<bool>(nullable: false, defaultValue: false),
                attempts   = table.Column<short>(nullable: false, defaultValue: (short)0),
                expires_at = table.Column<DateTimeOffset>(nullable: false),
                created_at = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
            },
            constraints: table => table.PrimaryKey("pk_otp_requests", x => x.id));

        migrationBuilder.CreateIndex("ix_otp_phone_purpose", "otp_requests",
            ["phone","purpose"], schema: "identity");
        migrationBuilder.CreateIndex("ix_otp_expires", "otp_requests", "expires_at", schema: "identity");

        // ── Refresh Tokens ────────────────────────────────────────────────────
        migrationBuilder.CreateTable(
            name:   "refresh_tokens",
            schema: "identity",
            columns: table => new
            {
                id         = table.Column<Guid>(nullable: false, defaultValueSql: "gen_random_uuid()"),
                user_id    = table.Column<Guid>(nullable: false),
                token      = table.Column<string>(maxLength: 200, nullable: false),
                is_revoked = table.Column<bool>(nullable: false, defaultValue: false),
                expires_at = table.Column<DateTimeOffset>(nullable: false),
                created_at = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_refresh_tokens", x => x.id);
                table.ForeignKey("fk_refresh_tokens_users", x => x.user_id,
                    principalSchema: "identity", principalTable: "users",
                    principalColumn: "id", onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex("ix_refresh_tokens_token", "refresh_tokens", "token",
            schema: "identity", unique: true);

        // ── User Devices ──────────────────────────────────────────────────────
        migrationBuilder.CreateTable(
            name:   "user_devices",
            schema: "identity",
            columns: table => new
            {
                id            = table.Column<Guid>(nullable: false, defaultValueSql: "gen_random_uuid()"),
                user_id       = table.Column<Guid>(nullable: false),
                device_id     = table.Column<string>(maxLength: 100, nullable: false),
                device_name   = table.Column<string>(maxLength: 200, nullable: false),
                platform      = table.Column<string>(maxLength: 20,  nullable: false),
                is_active     = table.Column<bool>(nullable: false, defaultValue: true),
                registered_at = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
                last_seen_at  = table.Column<DateTimeOffset>(nullable: true),
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_user_devices", x => x.id);
                table.ForeignKey("fk_user_devices_users", x => x.user_id,
                    principalSchema: "identity", principalTable: "users",
                    principalColumn: "id", onDelete: ReferentialAction.Cascade);
            });

        // ── Row-Level Security ────────────────────────────────────────────────
        migrationBuilder.Sql(@"
            ALTER TABLE identity.memberships ENABLE ROW LEVEL SECURITY;
            CREATE POLICY tenant_isolation ON identity.memberships
                USING (society_id::text = COALESCE(current_setting('app.current_society_id', true), ''));
        ");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("DROP POLICY IF EXISTS tenant_isolation ON identity.memberships;");
        migrationBuilder.DropTable("user_devices",   "identity");
        migrationBuilder.DropTable("refresh_tokens", "identity");
        migrationBuilder.DropTable("otp_requests",   "identity");
        migrationBuilder.DropTable("memberships",    "identity");
        migrationBuilder.DropTable("flats",          "identity");
        migrationBuilder.DropTable("users",          "identity");
        migrationBuilder.DropTable("societies",      "identity");
    }
}
