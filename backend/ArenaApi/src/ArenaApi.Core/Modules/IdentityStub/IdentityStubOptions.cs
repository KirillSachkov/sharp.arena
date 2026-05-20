namespace ArenaApi.Core.Modules.IdentityStub;

public sealed class IdentityStubOptions
{
    public const string SectionName = "IdentityStub";

    public Guid HardcodedUserId { get; init; }
}
