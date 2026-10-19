using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DigitalSocieties.Marketplace.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ServiceListingApproval : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "approval",
                schema: "marketplace",
                table: "service_listings",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Approved");

            migrationBuilder.AddColumn<string>(
                name: "rejection_reason",
                schema: "marketplace",
                table: "service_listings",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "approval",
                schema: "marketplace",
                table: "service_listings");

            migrationBuilder.DropColumn(
                name: "rejection_reason",
                schema: "marketplace",
                table: "service_listings");
        }
    }
}
