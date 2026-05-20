using System.Net;
using ArenaApi.IntegrationTests.Infrastructure;
using ArenaApi.IntegrationTests.Modules.Content;
using Xunit;

namespace ArenaApi.IntegrationTests;

[Collection(nameof(IntegrationTestsCollection))]
public sealed class HealthEndpointTests
{
    private readonly IntegrationTestsWebFactory _factory;

    public HealthEndpointTests(IntegrationTestsWebFactory factory) => _factory = factory;

    [Fact]
    public async Task HealthReturnsOk()
    {
        HttpClient client = _factory.CreateClient();
        HttpResponseMessage response = await client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
