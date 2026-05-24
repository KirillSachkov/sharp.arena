using ArenaApi.SharedKernel;
using ArenaApi.Core.Features.Health;
using ArenaApi.Modules.Execution.Infrastructure.Postgres;
using ArenaApi.Modules.IdentityStub.Infrastructure;
using ArenaApi.Modules.Progress.Infrastructure.Postgres;
using ArenaApi.Modules.Content.Application;
using ArenaApi.Modules.Content.Infrastructure.Postgres;
using ArenaApi.Web.Configuration;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

builder.Services.AddSharedKernel();

// Order matters: modules register their DbContexts first, then UseArenaWolverine
// wraps them with EF Core transactional middleware (IDbContextOutbox<T> resolves
// per DbContext at runtime).
builder.Services
    .AddIdentityStubModule(builder.Configuration)
    .AddContentModule(builder.Configuration)
    .AddExecutionModule(builder.Configuration)
    .AddProgressModule(builder.Configuration);

builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration.GetConnectionString(ConnectionStringNames.Redis);
});

builder.Services.AddHybridCache();

builder.UseArenaWolverine();

builder.Services.AddOpenApi();

WebApplication app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapHealthEndpoints();
app.MapContentEndpoints();

await app.RunAsync();

namespace ArenaApi.Web
{
    public sealed class Program;
}
