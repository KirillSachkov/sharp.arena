using ArenaApi.Core.Modules.Content.Features.CreatePackage;
using ArenaApi.Core.Modules.Content.Infrastructure;
using ArenaApi.Core.Modules.Content.Public;
using ArenaApi.Core.Shared.Time;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ArenaApi.Core.Modules.Content;

public static class ContentModule
{
    public static IServiceCollection AddContentModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<ContentDbContext>(options =>
            options.UseNpgsql(
                configuration.GetConnectionString(ArenaApi.Core.ConnectionStringNames.Database),
                npgsql => npgsql.MigrationsHistoryTable(
                    "__EFMigrationsHistory",
                    ContentDbContext.SchemaName)));

        services.AddScoped<IContentReader, ContentReader>();
        services.AddScoped<ContentOutboxService>();
        services.AddScoped<CreatePackageHandler>();
        services.AddSingleton<IClock, SystemClock>();

        return services;
    }

    public static IEndpointRouteBuilder MapContentEndpoints(this IEndpointRouteBuilder app)
    {
        RouteGroupBuilder packages = app.MapGroup("/api/packages");
        packages.MapCreatePackage();
        return app;
    }
}
