using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace ArenaApi.Core.Modules.Execution.Infrastructure;

internal sealed class ExecutionDbContextDesignTimeFactory : IDesignTimeDbContextFactory<ExecutionDbContext>
{
    public ExecutionDbContext CreateDbContext(string[] args)
    {
        DbContextOptionsBuilder<ExecutionDbContext> options = new();
        options.UseNpgsql(
            "Host=localhost;Database=sharp_arena;Username=arena;Password=arena",
            npgsql => npgsql.MigrationsHistoryTable(
                "__EFMigrationsHistory",
                ExecutionDbContext.SchemaName));
        return new ExecutionDbContext(options.Options);
    }
}
