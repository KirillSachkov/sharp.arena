using ArenaApi.Modules.IdentityStub.Contracts;
using ArenaApi.Modules.IdentityStub.Core;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ArenaApi.Modules.IdentityStub.Infrastructure;

public static class DependencyInjectionExtensions
{
    public static IServiceCollection AddIdentityStubInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services
            .AddOptions<IdentityStubOptions>()
            .Bind(configuration.GetSection(IdentityStubOptions.SectionName))
            .ValidateOnStart();

        services.AddSingleton<ICurrentUser, StubCurrentUser>();
        return services;
    }
}
