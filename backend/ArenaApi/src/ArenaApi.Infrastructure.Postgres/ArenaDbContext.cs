using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Infrastructure.Postgres;

public sealed class ArenaDbContext(DbContextOptions<ArenaDbContext> options) : DbContext(options)
{
    public const string SchemaName = "arena";

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(SchemaName);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ArenaDbContext).Assembly);
        base.OnModelCreating(modelBuilder);
    }
}
