using System.Net;
using ArenaApi.IntegrationTests.Infrastructure;
using Xunit;

namespace ArenaApi.IntegrationTests.Modules.Content;

[Collection(nameof(IntegrationTestsCollection))]
public sealed class AdminAuthorizationTests
{
    private readonly IntegrationTestsWebFactory _factory;

    public AdminAuthorizationTests(IntegrationTestsWebFactory factory) => _factory = factory;

    [Fact(Skip = "Admin endpoints land in Task 19; full wiring in Task 29.")]
    public async Task Anonymous_call_to_admin_endpoint_returns_403()
    {
        HttpClient anon = _factory.CreateAnonymousClient();

        HttpResponseMessage resp = await anon.GetAsync("/api/admin/topics/");

        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
        string body = await resp.Content.ReadAsStringAsync();
        Assert.Contains("Forbidden.Admin", body, StringComparison.Ordinal);
    }

    [Fact(Skip = "Admin endpoints land in Task 19; full wiring in Task 29.")]
    public async Task Admin_call_to_admin_endpoint_returns_200()
    {
        HttpClient admin = _factory.CreateAdminClient();
        await _factory.ResetContentSchemaAsync();

        HttpResponseMessage resp = await admin.GetAsync("/api/admin/topics/");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }
}
