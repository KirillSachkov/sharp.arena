using ArenaApi.Modules.Content.Infrastructure.Postgres;
using ArenaApi.Web;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Testcontainers.PostgreSql;
using Testcontainers.RabbitMq;
using Xunit;

namespace ArenaApi.IntegrationTests.Infrastructure;

public sealed class IntegrationTestsWebFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:17-alpine")
        .WithDatabase("sharp_arena")
        .WithUsername("arena")
        .WithPassword("arena")
        .Build();

    private readonly RabbitMqContainer _rabbit = new RabbitMqBuilder("rabbitmq:3.13-management-alpine")
        .Build();

    /// Default value for IdentityStub:IsAdmin when CreateClient() is called.
    /// Tests that need the opposite create a customised client via CreateAdminClient()
    /// or CreateAnonymousClient(); the default mirrors a non-admin anonymous browser.
    public bool DefaultIsAdmin { get; set; } = true;

    public string PostgresConnectionString => _postgres.GetConnectionString();

    public string RabbitConnectionString => _rabbit.GetConnectionString();

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();
        await _rabbit.StartAsync();
        await CreateSchemasAsync();

        // Eagerly construct the WebHost so module DbContexts are available,
        // then run EF migrations for the Content module. Execution and
        // Progress have no migrations yet — schema-only is enough.
        using IServiceScope scope = Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<ContentDbContext>().Database.MigrateAsync();
    }

    public new async Task DisposeAsync()
    {
        await _postgres.DisposeAsync();
        await _rabbit.DisposeAsync();
        await base.DisposeAsync();
    }

    public HttpClient CreateAdminClient() => CreateClientWithAdmin(true);

    public HttpClient CreateAnonymousClient() => CreateClientWithAdmin(false);

    private HttpClient CreateClientWithAdmin(bool isAdmin) =>
        WithWebHostBuilder(b => b.UseSetting("IdentityStub:IsAdmin", isAdmin ? "true" : "false"))
            .CreateClient();

    public async Task ResetContentSchemaAsync()
    {
        await using NpgsqlConnection conn = new(PostgresConnectionString);
        await conn.OpenAsync();
        await using NpgsqlCommand cmd = conn.CreateCommand();
        cmd.CommandText = """
            TRUNCATE TABLE arena_content.collection_tasks,
                           arena_content.collections,
                           arena_content.task_unit_tests,
                           arena_content.task_assets,
                           arena_content.task_topics,
                           arena_content.tasks,
                           arena_content.topics,
                           arena_content.packages
            RESTART IDENTITY CASCADE;
        """;
        await cmd.ExecuteNonQueryAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("ConnectionStrings:Database", PostgresConnectionString);
        builder.UseSetting("ConnectionStrings:RabbitMq", RabbitConnectionString);
        // Redis is wired in Program.cs but not exercised by these tests.
        // Point it at a harmless host:port — StackExchangeRedisCache only
        // connects when actually used.
        builder.UseSetting("ConnectionStrings:Redis", "localhost:6379");
        builder.UseSetting("IdentityStub:HardcodedUserId", Guid.CreateVersion7().ToString());
        builder.UseSetting("IdentityStub:IsAdmin", DefaultIsAdmin ? "true" : "false");

        // Disable the catalog seeder during tests — every test sets its own
        // fixtures. CatalogSeederHostedService inspects this flag and exits early.
        builder.UseSetting("Content:DisableCatalogSeeder", "true");
    }

    private async Task CreateSchemasAsync()
    {
        await using NpgsqlConnection conn = new(PostgresConnectionString);
        await conn.OpenAsync();
        await using NpgsqlCommand cmd = conn.CreateCommand();
        cmd.CommandText = """
            CREATE EXTENSION IF NOT EXISTS ltree;
            CREATE SCHEMA IF NOT EXISTS arena_content;
            CREATE SCHEMA IF NOT EXISTS arena_execution;
            CREATE SCHEMA IF NOT EXISTS arena_progress;
            CREATE SCHEMA IF NOT EXISTS arena_identity;
            CREATE SCHEMA IF NOT EXISTS arena_wolverine;
        """;
        await cmd.ExecuteNonQueryAsync();
    }
}
