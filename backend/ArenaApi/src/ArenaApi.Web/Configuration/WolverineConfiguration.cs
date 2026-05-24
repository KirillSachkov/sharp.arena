using ArenaApi.SharedKernel;
using ArenaApi.Modules.Content.Application;
using Wolverine;
using Wolverine.EntityFrameworkCore;
using Wolverine.Postgresql;
using Wolverine.RabbitMQ;

namespace ArenaApi.Web.Configuration;

public static class WolverineConfiguration
{
    public const string WolverineSchema = "arena_wolverine";

    /// <summary>
    /// Wires Wolverine with Postgres durable storage, RabbitMQ transport,
    /// the EF Core transactional middleware, and handler discovery for the
    /// Core assembly.
    /// </summary>
    /// <remarks>
    /// Extends <see cref="IHostApplicationBuilder"/> (which <c>WebApplicationBuilder</c>
    /// implements) because Wolverine 5.x's <c>UseWolverine(IHostApplicationBuilder,...)</c>
    /// overload is the only one whose callback can access <see cref="IConfiguration"/>
    /// — the <see cref="IHostBuilder"/> overload only passes a bare
    /// <c>Action&lt;WolverineOptions&gt;</c>.
    /// </remarks>
    public static IHostApplicationBuilder UseArenaWolverine(this IHostApplicationBuilder builder)
    {
        string pgConnection =
            builder.Configuration.GetConnectionString(ConnectionStringNames.Database)
            ?? throw new InvalidOperationException(
                $"ConnectionStrings:{ConnectionStringNames.Database} is missing.");

        string rabbitConnection =
            builder.Configuration.GetConnectionString(ConnectionStringNames.RabbitMq)
            ?? throw new InvalidOperationException(
                $"ConnectionStrings:{ConnectionStringNames.RabbitMq} is missing.");

        builder.UseWolverine(opts =>
        {
            opts.PersistMessagesWithPostgresql(pgConnection, WolverineSchema);

            opts.UseRabbitMq(new Uri(rabbitConnection))
                .AutoProvision()
                .UseConventionalRouting();

            // Even when consumer is in-process, route messages through the broker so
            // future microservice extraction is mechanical (no code change at call site).
            opts.Policies.UseDurableInboxOnAllListeners();
            opts.Policies.UseDurableOutboxOnAllSendingEndpoints();

            // EF Core transactional middleware. Each module's DbContext is already
            // registered via Add<Module>Module() in Program.cs, so a single call
            // here enrolls all of them: IDbContextOutbox<TDbContext> resolves at
            // runtime for ContentDbContext / ExecutionDbContext / ProgressDbContext.
            opts.UseEntityFrameworkCoreTransactions();

            // Handler discovery: PackageCreatedHandler lives in ArenaApi.Core, not
            // in the entry assembly (ArenaApi.Web). Wolverine 5.x scans the calling
            // assembly by default, so we must include Core explicitly.
            opts.Discovery.IncludeAssembly(typeof(ContentApplicationAssemblyMarker).Assembly);
        });

        return builder;
    }
}
