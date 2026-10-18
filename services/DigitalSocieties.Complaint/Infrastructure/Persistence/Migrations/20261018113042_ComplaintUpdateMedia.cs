using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DigitalSocieties.Complaint.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ComplaintUpdateMedia : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "MediaIdsJson",
                schema: "complaint",
                table: "complaint_updates",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MediaIdsJson",
                schema: "complaint",
                table: "complaint_updates");
        }
    }
}
