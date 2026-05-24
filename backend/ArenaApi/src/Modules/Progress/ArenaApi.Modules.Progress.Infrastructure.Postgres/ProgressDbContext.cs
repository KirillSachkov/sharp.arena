using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Modules.Progress.Infrastructure.Postgres;

public sealed class ProgressDbContext(DbContextOptions<ProgressDbContext> options) : DbContext(options)
{
    public const string SchemaName = "arena_progress";

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(SchemaName);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ProgressDbContext).Assembly);
        base.OnModelCreating(modelBuilder);
    }
}
