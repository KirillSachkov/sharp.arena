using ArenaApi.Core.Features.Health;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

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
