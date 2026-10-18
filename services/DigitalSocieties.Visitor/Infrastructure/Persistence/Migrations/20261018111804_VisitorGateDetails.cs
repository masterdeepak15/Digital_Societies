using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DigitalSocieties.Visitor.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class VisitorGateDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CompanionsJson",
                schema: "visitor",
                table: "visitors",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IdLast4",
                schema: "visitor",
                table: "visitors",
                type: "character varying(4)",
                maxLength: 4,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IdPhotoMediaId",
                schema: "visitor",
                table: "visitors",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IdType",
                schema: "visitor",
                table: "visitors",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PhotoMediaId",
                schema: "visitor",
                table: "visitors",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VehicleType",
                schema: "visitor",
                table: "visitors",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_visitors_SocietyId_Phone",
                schema: "visitor",
                table: "visitors",
                columns: new[] { "SocietyId", "Phone" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_visitors_SocietyId_Phone",
                schema: "visitor",
                table: "visitors");

            migrationBuilder.DropColumn(
                name: "CompanionsJson",
                schema: "visitor",
                table: "visitors");

            migrationBuilder.DropColumn(
                name: "IdLast4",
                schema: "visitor",
                table: "visitors");

            migrationBuilder.DropColumn(
                name: "IdPhotoMediaId",
                schema: "visitor",
                table: "visitors");

            migrationBuilder.DropColumn(
                name: "IdType",
                schema: "visitor",
                table: "visitors");

            migrationBuilder.DropColumn(
                name: "PhotoMediaId",
                schema: "visitor",
                table: "visitors");

            migrationBuilder.DropColumn(
                name: "VehicleType",
                schema: "visitor",
                table: "visitors");
        }
    }
}
