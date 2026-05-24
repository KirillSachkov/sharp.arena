namespace ArenaApi.Modules.IdentityStub.Core;

public sealed class IdentityStubOptions
{
    public const string SectionName = "IdentityStub";

    public Guid HardcodedUserId { get; init; }
}
