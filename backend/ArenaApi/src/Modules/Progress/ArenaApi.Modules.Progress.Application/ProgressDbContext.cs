using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Modules.Progress.Application;

public sealed class ProgressDbContext(DbContextOptions<ProgressDbContext> options) : DbContext(options)
{
    public const string SchemaName = "arena_progress";

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(SchemaName);
        modelBuilder.ApplyConfigurationsFromAssembly(
            typeof(ProgressDbContext).Assembly,
            t => t.Namespace?.StartsWith("ArenaApi.Modules.Progress.Application.Configurations", StringComparison.Ordinal) == true);
        base.OnModelCreating(modelBuilder);
    }
}
