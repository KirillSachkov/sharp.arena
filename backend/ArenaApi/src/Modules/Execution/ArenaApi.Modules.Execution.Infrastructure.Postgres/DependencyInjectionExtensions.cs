using ArenaApi.Modules.Execution.Core.Database;
using ArenaApi.Modules.Execution.Infrastructure.Postgres.Database;
using ArenaApi.SharedKernel;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ArenaApi.Modules.Execution.Infrastructure.Postgres;

public static class DependencyInjectionExtensions
{
    public static IServiceCollection AddExecutionInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<ExecutionDbContext>(options =>
            options.UseNpgsql(
                configuration.GetConnectionString(ConnectionStringNames.Database),
                npgsql => npgsql.MigrationsHistoryTable(
                    "__EFMigrationsHistory",
                    ExecutionDbContext.SchemaName)));

        services.AddScoped<IOutboxService, OutboxService>();
        services.AddScoped<ITransactionManager, TransactionManager>();

        return services;
    }
}
