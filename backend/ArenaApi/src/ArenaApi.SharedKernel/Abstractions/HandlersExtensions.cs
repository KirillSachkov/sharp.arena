using System.Reflection;
using Microsoft.Extensions.DependencyInjection;

namespace ArenaApi.SharedKernel.Abstractions;

public static class HandlersExtensions
{
    /// Scans the given assemblies for ICommandHandler / IQueryHandler implementations
    /// and registers each as scoped, exposed both as the concrete type and its
    /// implemented interfaces.
    public static IServiceCollection AddHandlers(this IServiceCollection services, params Assembly[] assemblies)
    {
        services.Scan(scan => scan.FromAssemblies(assemblies)
            .AddClasses(classes => classes
                .AssignableToAny(typeof(ICommandHandler<,>), typeof(ICommandHandlerUnit<>)))
            .AsSelfWithInterfaces()
            .WithScopedLifetime());

        services.Scan(scan => scan.FromAssemblies(assemblies)
            .AddClasses(classes => classes
                .AssignableToAny(typeof(IQueryHandler<,>), typeof(IQueryHandlerWithResult<,>)))
            .AsSelfWithInterfaces()
            .WithScopedLifetime());

        return services;
    }
}
