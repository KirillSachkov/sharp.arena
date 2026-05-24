namespace ArenaApi.Modules.IdentityStub.Core;

public sealed class IdentityStubOptions
{
    public const string SectionName = "IdentityStub";

    public Guid HardcodedUserId { get; init; }

    /// Single global admin flag. In local dev this is `true`; in production
    /// (when SSO doesn't exist yet) it stays `false`. Replaced by real role
    /// checks once SSO ships.
    public bool IsAdmin { get; init; }
}
