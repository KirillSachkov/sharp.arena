using ArenaApi.Modules.IdentityStub.Application;
using ArenaApi.Modules.IdentityStub.Public;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ArenaApi.Modules.IdentityStub.Infrastructure;

public static class IdentityStubModule
{
    public static IServiceCollection AddIdentityStubModule(
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
