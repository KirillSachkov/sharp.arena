using ArenaApi.SharedKernel.Time;
using Microsoft.Extensions.DependencyInjection;

namespace ArenaApi.SharedKernel;

public static class SharedKernelServiceCollectionExtensions
{
    /// Registers the SharedKernel's DI services (IClock → SystemClock).
    /// Idempotent — safe to call from multiple module registrations.
    public static IServiceCollection AddSharedKernel(this IServiceCollection services)
    {
        services.AddSingleton<IClock, SystemClock>();
        return services;
    }
}
