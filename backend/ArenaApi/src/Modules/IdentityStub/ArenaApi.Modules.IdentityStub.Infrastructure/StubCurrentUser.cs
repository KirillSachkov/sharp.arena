using ArenaApi.Modules.IdentityStub.Core;
using ArenaApi.Modules.IdentityStub.Contracts;
using Microsoft.Extensions.Options;

namespace ArenaApi.Modules.IdentityStub.Infrastructure;

internal sealed class StubCurrentUser(IOptions<IdentityStubOptions> options) : ICurrentUser
{
    public Guid UserId { get; } = options.Value.HardcodedUserId == Guid.Empty
        ? throw new InvalidOperationException(
            $"{nameof(IdentityStubOptions)}.{nameof(IdentityStubOptions.HardcodedUserId)} is not configured. " +
            "Set IdentityStub:HardcodedUserId in appsettings.")
        : options.Value.HardcodedUserId;
}
