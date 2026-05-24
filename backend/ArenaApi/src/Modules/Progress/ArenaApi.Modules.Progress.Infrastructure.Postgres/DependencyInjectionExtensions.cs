using ArenaApi.Modules.Progress.Core.Database;
using ArenaApi.Modules.Progress.Infrastructure.Postgres.Database;
using ArenaApi.SharedKernel;
using ArenaApi.SharedKernel.Database;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ArenaApi.Modules.Progress.Infrastructure.Postgres;

public static class DependencyInjectionExtensions
{
    public static IServiceCollection AddProgressInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<ProgressDbContext>(options =>
            options.UseNpgsql(
                configuration.GetConnectionString(ConnectionStringNames.Database),
                npgsql => npgsql.MigrationsHistoryTable(
                    "__EFMigrationsHistory",
                    ProgressDbContext.SchemaName)));

        services.AddScoped<IOutboxService, OutboxService>();
        services.AddScoped<ITransactionManager, TransactionManager>();

        return services;
    }
}
