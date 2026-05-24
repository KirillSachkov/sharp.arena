using ArenaApi.Modules.Content.Domain;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Modules.Content.Infrastructure.Postgres;

public sealed class ContentDbContext(DbContextOptions<ContentDbContext> options) : DbContext(options)
{
    public const string SchemaName = "arena_content";

    public DbSet<Package> Packages => Set<Package>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(SchemaName);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ContentDbContext).Assembly);
        base.OnModelCreating(modelBuilder);
    }
}
