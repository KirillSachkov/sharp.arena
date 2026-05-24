using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Modules.Execution.Infrastructure.Postgres;

public sealed class ExecutionDbContext(DbContextOptions<ExecutionDbContext> options) : DbContext(options)
{
    public const string SchemaName = "arena_execution";

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(SchemaName);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ExecutionDbContext).Assembly);
        base.OnModelCreating(modelBuilder);
    }
}
