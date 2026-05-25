using ArenaApi.Web.Utils;
using Xunit;

namespace ArenaApi.UnitTests.Utils;

public class SlugifierTests
{
    [Theory]
    [InlineData("Hello World", "hello-world")]
    [InlineData("  Trim  Me  ", "trim-me")]
    [InlineData("C# & .NET!!!", "c-net")]
    [InlineData("", "")]
    [InlineData(null, "")]
    public void Slugify_ProducesUrlSafeSlug(string? input, string expected)
    {
        Assert.Equal(expected, Slugifier.Slugify(input));
    }
}