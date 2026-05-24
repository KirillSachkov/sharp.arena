using ArenaApi.Modules.Content.Application;
using ArenaApi.Modules.Content.Application.Features.CreatePackage;
using ArenaApi.Modules.Content.Public;
using ArenaApi.SharedKernel;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ArenaApi.Modules.Content.Infrastructure.Postgres;

public static class ContentModule
{
    public static IServiceCollection AddContentModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<ContentDbContext>(options =>
            options.UseNpgsql(
                configuration.GetConnectionString(ConnectionStringNames.Database),
                npgsql => npgsql.MigrationsHistoryTable(
                    "__EFMigrationsHistory",
                    ContentDbContext.SchemaName)));

        services.AddScoped<IContentReader, ContentReader>();
        services.AddScoped<ContentOutboxService>();
        services.AddScoped<CreatePackageHandler>();

        return services;
    }
}
