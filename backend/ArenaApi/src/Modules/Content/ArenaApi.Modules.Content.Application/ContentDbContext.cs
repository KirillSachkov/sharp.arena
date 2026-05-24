using ArenaApi.Modules.Content.Domain;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Modules.Content.Application;

public sealed class ContentDbContext(DbContextOptions<ContentDbContext> options) : DbContext(options)
{
    public const string SchemaName = "arena_content";

    public DbSet<Package> Packages => Set<Package>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(SchemaName);
        modelBuilder.ApplyConfigurationsFromAssembly(
            typeof(ContentDbContext).Assembly,
            t => t.Namespace?.StartsWith("ArenaApi.Modules.Content.Application.Configurations", StringComparison.Ordinal) == true);
        base.OnModelCreating(modelBuilder);
    }
}
