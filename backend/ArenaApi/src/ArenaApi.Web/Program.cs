using ArenaApi.Core;
using ArenaApi.Core.Features.Health;
using ArenaApi.Infrastructure.Postgres;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddCore(builder.Configuration)
    .AddInfrastructurePostgres(builder.Configuration);

builder.Services.AddOpenApi();

WebApplication app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapHealthEndpoints();

await app.RunAsync();

namespace ArenaApi.Web
{
    public sealed class Program;
}
