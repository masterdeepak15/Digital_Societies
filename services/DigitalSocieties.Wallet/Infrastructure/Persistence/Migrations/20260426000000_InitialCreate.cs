using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DigitalSocieties.Wallet.Infrastructure.Persistence.Migrations;

public partial class InitialCreate : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.EnsureSchema(name: "wallet");

        migrationBuilder.CreateTable(
            name: "wallet_accounts", schema: "wallet",
            columns: table => new
            {
                id            = table.Column<Guid>(nullable: false, defaultValueSql: "gen_random_uuid()"),
                society_id    = table.Column<Guid>(nullable: false),
                flat_id       = table.Column<Guid>(nullable: false),
                owner_id      = table.Column<Guid>(nullable: false),
                balance_paise = table.Column<long>(nullable: false, defaultValue: 0L),
                is_active     = table.Column<bool>(nullable: false, defaultValue: true),
                is_deleted    = table.Column<bool>(nullable: false, defaultValue: false),
                created_at    = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
                created_by    = table.Column<Guid>(nullable: true),
                updated_at    = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
                updated_by    = table.Column<Guid>(nullable: true),
            },
            constraints: table => table.PrimaryKey("pk_wallet_accounts", x => x.id));

        migrationBuilder.CreateIndex("ix_wallet_accounts_society_flat",
            "wallet_accounts", ["society_id", "flat_id"], schema: "wallet", unique: true);

        migrationBuilder.CreateTable(
            name: "wallet_transactions", schema: "wallet",
            columns: table => new
            {
                id                  = table.Column<Guid>(nullable: false, defaultValueSql: "gen_random_uuid()"),
                wallet_id           = table.Column<Guid>(nullable: false),
                society_id          = table.Column<Guid>(nullable: false),
                amount_paise        = table.Column<long>(nullable: false),
                direction           = table.Column<string>(maxLength: 10, nullable: false),
                type                = table.Column<string>(maxLength: 30, nullable: false),
                description         = table.Column<string>(maxLength: 500, nullable: false),
                balance_after_paise = table.Column<long>(nullable: false),
                reference_id        = table.Column<string>(maxLength: 100, nullable: true),
                created_at          = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
                created_by          = table.Column<Guid>(nullable: true),
                updated_at          = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
                updated_by          = table.Column<Guid>(nullable: true),
                is_deleted          = table.Column<bool>(nullable: false, defaultValue: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_wallet_transactions", x => x.id);
                table.ForeignKey("fk_wallet_transactions_accounts",
                    x => x.wallet_id, "wallet", "wallet_accounts", "id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex("ix_wallet_transactions_wallet_id",
            "wallet_transactions", "wallet_id", schema: "wallet");
        migrationBuilder.CreateIndex("ix_wallet_transactions_ref_id",
            "wallet_transactions", "reference_id", schema: "wallet");

        // ── RLS ──────────────────────────────────────────────────────────
        foreach (var tbl in new[] { "wallet_accounts", "wallet_transactions" })
        {
            migrationBuilder.Sql($"ALTER TABLE wallet.{tbl} ENABLE ROW LEVEL SECURITY;");
            migrationBuilder.Sql($@"
                CREATE POLICY society_isolation ON wallet.{tbl}
                    USING (society_id = current_setting('app.current_society_id', true)::uuid);");
        }
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        foreach (var tbl in new[] { "wallet_transactions", "wallet_accounts" })
            migrationBuilder.Sql($"DROP POLICY IF EXISTS society_isolation ON wallet.{tbl};");

        migrationBuilder.DropTable("wallet_transactions", "wallet");
        migrationBuilder.DropTable("wallet_accounts",     "wallet");
    }
}
