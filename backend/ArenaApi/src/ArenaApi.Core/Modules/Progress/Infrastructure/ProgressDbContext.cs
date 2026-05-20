using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Progress.Infrastructure;

public sealed class ProgressDbContext(DbContextOptions<ProgressDbContext> options) : DbContext(options)
{
    public const string SchemaName = "arena_progress";

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(SchemaName);
        modelBuilder.ApplyConfigurationsFromAssembly(
            typeof(ProgressDbContext).Assembly,
            t => t.Namespace?.StartsWith("ArenaApi.Core.Modules.Progress.Infrastructure.Configurations", StringComparison.Ordinal) == true);
        base.OnModelCreating(modelBuilder);
    }
}
