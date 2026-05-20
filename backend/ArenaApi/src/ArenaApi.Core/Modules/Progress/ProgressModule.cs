using ArenaApi.Core.Modules.Progress.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ArenaApi.Core.Modules.Progress;

public static class ProgressModule
{
    public static IServiceCollection AddProgressModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<ProgressDbContext>(options =>
            options.UseNpgsql(
                configuration.GetConnectionString(ArenaApi.Core.ConnectionStringNames.Database),
                npgsql => npgsql.MigrationsHistoryTable(
                    "__EFMigrationsHistory",
                    ProgressDbContext.SchemaName)));

        services.AddScoped<ProgressOutboxService>();
        return services;
    }
}
