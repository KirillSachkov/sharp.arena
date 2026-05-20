using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArenaApi.Core.Modules.Content.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ContentInitial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "arena_content");

            migrationBuilder.CreateTable(
                name: "packages",
                schema: "arena_content",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    slug = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_packages", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_packages_slug",
                schema: "arena_content",
                table: "packages",
                column: "slug",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "packages",
                schema: "arena_content");
        }
    }
}
