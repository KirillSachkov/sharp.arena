using ArenaApi.Modules.Progress.Application;
using ArenaApi.SharedKernel;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ArenaApi.Modules.Progress.Infrastructure.Postgres;

public static class ProgressModule
{
    public static IServiceCollection AddProgressModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<ProgressDbContext>(options =>
            options.UseNpgsql(
                configuration.GetConnectionString(ConnectionStringNames.Database),
                npgsql => npgsql.MigrationsHistoryTable(
                    "__EFMigrationsHistory",
                    ProgressDbContext.SchemaName)));

        services.AddScoped<ProgressOutboxService>();
        return services;
    }
}
