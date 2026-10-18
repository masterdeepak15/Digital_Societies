using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DigitalSocieties.Social.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PostIsHidden : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsHidden",
                schema: "social",
                table: "posts",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsHidden",
                schema: "social",
                table: "posts");
        }
    }
}
