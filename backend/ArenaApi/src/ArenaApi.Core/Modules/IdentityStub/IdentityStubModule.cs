using ArenaApi.Core.Modules.IdentityStub.Infrastructure;
using ArenaApi.Core.Modules.IdentityStub.Public;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ArenaApi.Core.Modules.IdentityStub;

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
