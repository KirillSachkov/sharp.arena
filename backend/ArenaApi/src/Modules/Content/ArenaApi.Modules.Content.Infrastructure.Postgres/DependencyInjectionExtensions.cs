using ArenaApi.Modules.Content.Contracts;
using ArenaApi.Modules.Content.Core.Database;
using ArenaApi.Modules.Content.Infrastructure.Postgres.Database;
using ArenaApi.SharedKernel;
using ArenaApi.SharedKernel.Database;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ArenaApi.Modules.Content.Infrastructure.Postgres;

public static class DependencyInjectionExtensions
{
    public static IServiceCollection AddContentInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<ContentDbContext>(options =>
            options.UseNpgsql(
                configuration.GetConnectionString(ConnectionStringNames.Database),
                npgsql => npgsql.MigrationsHistoryTable(
                    "__EFMigrationsHistory",
                    ContentDbContext.SchemaName)));

        services.AddScoped<IPackagesRepository, PackagesRepository>();
        services.AddScoped<IContentReader, ContentReader>();
        services.AddScoped<IOutboxService, OutboxService>();
        services.AddScoped<ITransactionManager, TransactionManager>();

        return services;
    }
}
