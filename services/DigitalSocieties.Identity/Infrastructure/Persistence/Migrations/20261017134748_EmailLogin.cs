using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DigitalSocieties.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class EmailLogin : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Email becomes the identity. Never invent placeholder emails: if any user
            // lacks one, stop so an admin can set them first.
            migrationBuilder.Sql(@"
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM identity.users WHERE ""Email"" IS NULL OR btrim(""Email"") = '') THEN
        RAISE EXCEPTION 'Users without email exist; set emails before applying EmailLogin migration';
    END IF;
END $$;");

            migrationBuilder.Sql(@"UPDATE identity.users SET ""Email"" = lower(btrim(""Email""));");

            // OTP rows are short-lived; the key column changes from phone to email.
            migrationBuilder.Sql(@"DELETE FROM identity.otp_requests;");

            migrationBuilder.DropIndex(
                name: "IX_users_Phone",
                schema: "identity",
                table: "users");

            migrationBuilder.DropIndex(
                name: "IX_otp_requests_Phone_Purpose",
                schema: "identity",
                table: "otp_requests");

            migrationBuilder.DropColumn(
                name: "Phone",
                schema: "identity",
                table: "otp_requests");

            migrationBuilder.AlterColumn<string>(
                name: "Phone",
                schema: "identity",
                table: "users",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20);

            migrationBuilder.AlterColumn<string>(
                name: "Email",
                schema: "identity",
                table: "users",
                type: "character varying(250)",
                maxLength: 250,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(250)",
                oldMaxLength: 250,
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Email",
                schema: "identity",
                table: "otp_requests",
                type: "character varying(250)",
                maxLength: 250,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_users_Email",
                schema: "identity",
                table: "users",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_Phone",
                schema: "identity",
                table: "users",
                column: "Phone",
                unique: true,
                filter: "\"Phone\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_otp_requests_Email_Purpose",
                schema: "identity",
                table: "otp_requests",
                columns: new[] { "Email", "Purpose" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_users_Email",
                schema: "identity",
                table: "users");

            migrationBuilder.DropIndex(
                name: "IX_users_Phone",
                schema: "identity",
                table: "users");

            migrationBuilder.DropIndex(
                name: "IX_otp_requests_Email_Purpose",
                schema: "identity",
                table: "otp_requests");

            migrationBuilder.DropColumn(
                name: "Email",
                schema: "identity",
                table: "otp_requests");

            migrationBuilder.AlterColumn<string>(
                name: "Phone",
                schema: "identity",
                table: "users",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Email",
                schema: "identity",
                table: "users",
                type: "character varying(250)",
                maxLength: 250,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(250)",
                oldMaxLength: 250);

            migrationBuilder.AddColumn<string>(
                name: "Phone",
                schema: "identity",
                table: "otp_requests",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_users_Phone",
                schema: "identity",
                table: "users",
                column: "Phone",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_otp_requests_Phone_Purpose",
                schema: "identity",
                table: "otp_requests",
                columns: new[] { "Phone", "Purpose" });
        }
    }
}
