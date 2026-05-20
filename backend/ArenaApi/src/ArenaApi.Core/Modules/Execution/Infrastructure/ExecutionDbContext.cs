using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Execution.Infrastructure;

public sealed class ExecutionDbContext(DbContextOptions<ExecutionDbContext> options) : DbContext(options)
{
    public const string SchemaName = "arena_execution";

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(SchemaName);
        modelBuilder.ApplyConfigurationsFromAssembly(
            typeof(ExecutionDbContext).Assembly,
            t => t.Namespace?.StartsWith("ArenaApi.Core.Modules.Execution.Infrastructure.Configurations", StringComparison.Ordinal) == true);
        base.OnModelCreating(modelBuilder);
    }
}
