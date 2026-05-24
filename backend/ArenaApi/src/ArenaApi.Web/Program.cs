using ArenaApi.Modules.Content.Core;
using ArenaApi.Modules.Content.Infrastructure.Postgres;
using ArenaApi.Modules.Execution.Infrastructure.Postgres;
using ArenaApi.Modules.IdentityStub.Infrastructure;
using ArenaApi.Modules.Progress.Infrastructure.Postgres;
using ArenaApi.SharedKernel;
using ArenaApi.SharedKernel.Abstractions;
using ArenaApi.SharedKernel.Endpoints;
using ArenaApi.Web.Configuration;
using ArenaApi.Web.Health;
using FluentValidation;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

builder.Services.AddSharedKernel();

// Order matters: modules register their DbContexts first, then UseArenaWolverine
// wraps them with EF Core transactional middleware (IDbContextOutbox<T> resolves
// per DbContext at runtime).
builder.Services
    .AddIdentityStubInfrastructure(builder.Configuration)
    .AddContentInfrastructure(builder.Configuration)
    .AddExecutionInfrastructure(builder.Configuration)
    .AddProgressInfrastructure(builder.Configuration);

// Content handlers + validators + endpoints — registered from Core assembly.
// (Execution/Progress/IdentityStub register their handlers in later tasks.)
builder.Services.AddHandlers(typeof(ContentCoreAssemblyMarker).Assembly);
builder.Services.AddValidatorsFromAssembly(typeof(ContentCoreAssemblyMarker).Assembly);
builder.Services.AddEndpoints(typeof(ContentCoreAssemblyMarker).Assembly);

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
app.MapEndpoints();

await app.RunAsync();

namespace ArenaApi.Web
{
    public sealed class Program;
}
