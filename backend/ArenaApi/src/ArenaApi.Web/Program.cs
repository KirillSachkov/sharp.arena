using System.Reflection;
using ArenaApi.Modules.Content.Core;
using ArenaApi.Modules.Content.Infrastructure.Postgres;
using ArenaApi.Modules.Execution.Core;
using ArenaApi.Modules.Execution.Infrastructure.Postgres;
using ArenaApi.Modules.IdentityStub.Core;
using ArenaApi.Modules.IdentityStub.Infrastructure;
using ArenaApi.Modules.Progress.Core;
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

Assembly[] moduleCoreAssemblies =
[
    typeof(ContentCoreAssemblyMarker).Assembly,
    typeof(ExecutionCoreAssemblyMarker).Assembly,
    typeof(ProgressCoreAssemblyMarker).Assembly,
    typeof(IdentityStubCoreAssemblyMarker).Assembly,
];

builder.Services.AddHandlers(moduleCoreAssemblies);
foreach (Assembly assembly in moduleCoreAssemblies)
{
    builder.Services.AddValidatorsFromAssembly(assembly);
    builder.Services.AddEndpoints(assembly);
}

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
