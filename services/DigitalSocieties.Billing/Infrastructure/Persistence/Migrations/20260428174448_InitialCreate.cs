using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DigitalSocieties.Billing.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "billing");

            migrationBuilder.CreateTable(
                name: "bills",
                schema: "billing",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SocietyId = table.Column<Guid>(type: "uuid", nullable: false),
                    FlatId = table.Column<Guid>(type: "uuid", nullable: false),
                    Period = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    amount_paise = table.Column<long>(type: "bigint", nullable: false),
                    amount_currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false, defaultValue: "INR"),
                    late_fee_paise = table.Column<long>(type: "bigint", nullable: false, defaultValue: 0L),
                    late_fee_currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false, defaultValue: "INR"),
                    DueDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    PaidAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    PaymentId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bills", x => x.Id);
                    table.CheckConstraint("chk_bills_amount_positive", "amount_paise >= 0");
                });

            migrationBuilder.CreateTable(
                name: "payments",
                schema: "billing",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BillId = table.Column<Guid>(type: "uuid", nullable: false),
                    SocietyId = table.Column<Guid>(type: "uuid", nullable: false),
                    FlatId = table.Column<Guid>(type: "uuid", nullable: false),
                    amount_paise = table.Column<long>(type: "bigint", nullable: false),
                    amount_currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false, defaultValue: "INR"),
                    Gateway = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    GatewayOrderId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    GatewayPaymentId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    InitiatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CompletedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_payments_bills_BillId",
                        column: x => x.BillId,
                        principalSchema: "billing",
                        principalTable: "bills",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bills_DueDate",
                schema: "billing",
                table: "bills",
                column: "DueDate");

            migrationBuilder.CreateIndex(
                name: "IX_bills_SocietyId_FlatId_Period",
                schema: "billing",
                table: "bills",
                columns: new[] { "SocietyId", "FlatId", "Period" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_bills_SocietyId_Status",
                schema: "billing",
                table: "bills",
                columns: new[] { "SocietyId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_payments_BillId",
                schema: "billing",
                table: "payments",
                column: "BillId");

            migrationBuilder.CreateIndex(
                name: "IX_payments_GatewayOrderId",
                schema: "billing",
                table: "payments",
                column: "GatewayOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_payments_GatewayPaymentId",
                schema: "billing",
                table: "payments",
                column: "GatewayPaymentId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "payments",
                schema: "billing");

            migrationBuilder.DropTable(
                name: "bills",
                schema: "billing");
        }
    }
}
