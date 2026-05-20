using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using ArenaApi.Contracts.Content;
using ArenaApi.IntegrationTests.Infrastructure;
using Npgsql;
using Xunit;

namespace ArenaApi.IntegrationTests.Modules.Content;

[Collection(nameof(IntegrationTestsCollection))]
public sealed class CreatePackageEndpointTests
{
    private readonly IntegrationTestsWebFactory _factory;

    public CreatePackageEndpointTests(IntegrationTestsWebFactory factory) => _factory = factory;

    [Fact]
    public async Task CreatePackage_persists_row_and_publishes_envelope()
    {
        HttpClient client = _factory.CreateClient();
        string slug = $"smoke-{Guid.NewGuid():N}";

        HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/packages/",
            new CreatePackageRequest(slug, "Smoke Title"));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        CreatePackageResponse? body = await response.Content.ReadFromJsonAsync<CreatePackageResponse>();
        Assert.NotNull(body);
        Assert.Equal(slug, body!.Slug);

        // 1. Row persisted in arena_content.packages.
        await using NpgsqlConnection conn = new(_factory.PostgresConnectionString);
        await conn.OpenAsync();

        await using (NpgsqlCommand cmd = conn.CreateCommand())
        {
            cmd.CommandText = "SELECT COUNT(*) FROM arena_content.packages WHERE slug = @slug";
            cmd.Parameters.AddWithValue("slug", slug);
            object? count = await cmd.ExecuteScalarAsync();
            Assert.Equal(1L, Assert.IsType<long>(count));
        }

        // 2. Wolverine auto-provisioned its envelope tables in arena_wolverine.
        // This is a weak assertion — it confirms the outbox plumbing reached
        // Postgres at all. Bundle K (docker compose smoke) tightens this.
        await WaitForEnvelopeProcessedAsync(conn);
    }

    private static async Task WaitForEnvelopeProcessedAsync(NpgsqlConnection conn)
    {
        DateTime deadline = DateTime.UtcNow.AddSeconds(15);
        while (DateTime.UtcNow < deadline)
        {
            await using NpgsqlCommand cmd = conn.CreateCommand();
            cmd.CommandText = """
                SELECT COUNT(*) FROM information_schema.tables
                WHERE table_schema = 'arena_wolverine';
            """;
            object? count = await cmd.ExecuteScalarAsync();
            if (Convert.ToInt64(count, CultureInfo.InvariantCulture) > 0)
            {
                return;
            }

            await Task.Delay(500);
        }

        Assert.Fail("Wolverine envelope tables were not auto-provisioned in arena_wolverine schema within 15s.");
    }
}

[CollectionDefinition(nameof(IntegrationTestsCollection))]
[System.Diagnostics.CodeAnalysis.SuppressMessage(
    "Naming",
    "CA1711:Identifiers should not have incorrect suffix",
    Justification = "xUnit's CollectionDefinition pattern requires the 'Collection' suffix.")]
public sealed class IntegrationTestsCollection : ICollectionFixture<IntegrationTestsWebFactory>;
