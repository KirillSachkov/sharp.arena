using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace ArenaApi.Core.Modules.Progress.Infrastructure;

internal sealed class ProgressDbContextDesignTimeFactory : IDesignTimeDbContextFactory<ProgressDbContext>
{
    public ProgressDbContext CreateDbContext(string[] args)
    {
        DbContextOptionsBuilder<ProgressDbContext> options = new();
        options.UseNpgsql(
            "Host=localhost;Database=sharp_arena;Username=arena;Password=arena",
            npgsql => npgsql.MigrationsHistoryTable(
                "__EFMigrationsHistory",
                ProgressDbContext.SchemaName));
        return new ProgressDbContext(options.Options);
    }
}
