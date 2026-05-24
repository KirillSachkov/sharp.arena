namespace ArenaApi.Modules.IdentityStub.Application;

public sealed class IdentityStubOptions
{
    public const string SectionName = "IdentityStub";

    public Guid HardcodedUserId { get; init; }
}
