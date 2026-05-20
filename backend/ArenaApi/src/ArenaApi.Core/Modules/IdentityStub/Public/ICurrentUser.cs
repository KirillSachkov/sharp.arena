namespace ArenaApi.Core.Modules.IdentityStub.Public;

/// The only contract other modules see from IdentityStub. When real SSO
/// arrives, the implementation behind this interface swaps; consumers don't
/// change. Do not add anything else here unless every consumer truly needs it.
public interface ICurrentUser
{
    Guid UserId { get; }
}
