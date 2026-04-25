using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DigitalSocieties.Accounting.Infrastructure.Persistence.Migrations;

/// <inheritdoc />
public partial class InitialCreate : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.EnsureSchema(name: "accounting");

        // ── Ledger entries ─────────────────────────────────────────────────────
        migrationBuilder.CreateTable(
            name:   "ledger_entries",
            schema: "accounting",
            columns: table => new
            {
                id               = table.Column<Guid>(nullable: false, defaultValueSql: "gen_random_uuid()"),
                society_id       = table.Column<Guid>(nullable: false),
                type             = table.Column<string>(maxLength: 20, nullable: false),        // Income | Expense
                category         = table.Column<string>(maxLength: 100, nullable: false),
                description      = table.Column<string>(maxLength: 500, nullable: false),
                amount_paise     = table.Column<long>(nullable: false),
                entry_date       = table.Column<DateOnly>(nullable: false),
                posted_by        = table.Column<Guid>(nullable: false),
                status           = table.Column<string>(maxLength: 30, nullable: false, defaultValue: "Approved"),
                approved_by      = table.Column<Guid>(nullable: true),
                approved_at      = table.Column<DateTimeOffset>(nullable: true),
                rejection_reason = table.Column<string>(maxLength: 500, nullable: true),
                receipt_url      = table.Column<string>(maxLength: 500, nullable: true),
                is_deleted       = table.Column<bool>(nullable: false, defaultValue: false),
                created_at       = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
                created_by       = table.Column<Guid>(nullable: true),
                updated_at       = table.Column<DateTimeOffset>(nullable: false, defaultValueSql: "NOW()"),
                updated_by       = table.Column<Guid>(nullable: true),
            },
            constraints: table => table.PrimaryKey("pk_ledger_entries", x => x.id));

        migrationBuilder.CreateIndex("ix_ledger_entries_society_id",
            "ledger_entries", "society_id", schema: "accounting");

        migrationBuilder.CreateIndex("ix_ledger_entries_entry_date",
            "ledger_entries", "entry_date", schema: "accounting");

        migrationBuilder.CreateIndex("ix_ledger_entries_society_status",
            "ledger_entries", ["society_id", "status"], schema: "accounting");

        // ── Row-Level Security (multi-tenant isolation) ────────────────────────
        migrationBuilder.Sql(
            "ALTER TABLE accounting.ledger_entries ENABLE ROW LEVEL SECURITY;");

        migrationBuilder.Sql(@"
            CREATE POLICY society_isolation ON accounting.ledger_entries
                USING (society_id = current_setting('app.current_society_id', true)::uuid);");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("DROP POLICY IF EXISTS society_isolation ON accounting.ledger_entries;");
        migrationBuilder.DropTable(name: "ledger_entries", schema: "accounting");
    }
}
