using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using ArenaApi.Web;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace ArenaApi.IntegrationTests;

public class HealthEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public HealthEndpointTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact(Skip = "Wired in Phase 1 once Testcontainers Postgres is required end-to-end.")]
    public async Task HealthReturnsOk()
    {
        HttpClient client = _factory.CreateClient();
        HttpResponseMessage response = await client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
