using ArenaApi.Core.Modules.IdentityStub;
using ArenaApi.Core.Modules.IdentityStub.Infrastructure;
using Microsoft.Extensions.Options;
using Xunit;

namespace ArenaApi.UnitTests.Modules.IdentityStub;

public sealed class StubCurrentUserTests
{
    private static readonly Guid SampleUserId = Guid.Parse("01970000-0000-7000-8000-000000000099");

    [Fact]
    public void UserId_is_taken_from_options()
    {
        StubCurrentUser sut = new(Options.Create(new IdentityStubOptions
        {
            HardcodedUserId = SampleUserId,
            IsAdmin = false,
        }));

        Assert.Equal(SampleUserId, sut.UserId);
    }

    [Fact]
    public void IsAdmin_is_false_by_default_when_options_default()
    {
        StubCurrentUser sut = new(Options.Create(new IdentityStubOptions
        {
            HardcodedUserId = SampleUserId,
            // IsAdmin omitted → default false
        }));

        Assert.False(sut.IsAdmin);
    }

    [Fact]
    public void IsAdmin_is_true_when_configured_true()
    {
        StubCurrentUser sut = new(Options.Create(new IdentityStubOptions
        {
            HardcodedUserId = SampleUserId,
            IsAdmin = true,
        }));

        Assert.True(sut.IsAdmin);
    }

    [Fact]
    public void Throws_when_HardcodedUserId_empty()
    {
        Assert.Throws<InvalidOperationException>(() =>
            new StubCurrentUser(Options.Create(new IdentityStubOptions
            {
                HardcodedUserId = Guid.Empty,
                IsAdmin = true,
            })));
    }
}
