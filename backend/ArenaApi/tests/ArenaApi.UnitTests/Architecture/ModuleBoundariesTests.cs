using System.Reflection;
using NetArchTest.Rules;
using Xunit;

namespace ArenaApi.UnitTests.Architecture;

public sealed class ModuleBoundariesTests
{
    private static Assembly CoreAssembly =>
        typeof(ArenaApi.Core.Modules.Content.ContentModule).Assembly;

    private const string ContentNs = "ArenaApi.Core.Modules.Content";
    private const string ExecutionNs = "ArenaApi.Core.Modules.Execution";
    private const string ProgressNs = "ArenaApi.Core.Modules.Progress";
    private const string IdentityNs = "ArenaApi.Core.Modules.IdentityStub";

    [Fact]
    public void Content_internals_are_not_referenced_from_other_modules()
    {
        AssertNoCrossModuleInternalRef(sourceModule: ContentNs, otherModules: [ExecutionNs, ProgressNs]);
    }

    [Fact]
    public void Execution_internals_are_not_referenced_from_other_modules()
    {
        AssertNoCrossModuleInternalRef(sourceModule: ExecutionNs, otherModules: [ContentNs, ProgressNs]);
    }

    [Fact]
    public void Progress_internals_are_not_referenced_from_other_modules()
    {
        AssertNoCrossModuleInternalRef(sourceModule: ProgressNs, otherModules: [ContentNs, ExecutionNs]);
    }

    [Fact]
    public void IdentityStub_only_exposes_Public_namespace()
    {
        TestResult result = Types
            .InAssembly(CoreAssembly)
            .That()
            .ResideInNamespaceMatching($"^(?!{IdentityNs}).*")
            .ShouldNot()
            .HaveDependencyOn($"{IdentityNs}.Infrastructure")
            .GetResult();

        Assert.True(
            result.IsSuccessful,
            FailingTypesMessage("Non-IdentityStub code depends on IdentityStub.Infrastructure", result));
    }

    [Fact]
    public void DbContexts_are_not_referenced_outside_their_owning_module()
    {
        Assert.All(
            new (string Owner, string Type)[]
            {
                (ContentNs, $"{ContentNs}.Infrastructure.ContentDbContext"),
                (ExecutionNs, $"{ExecutionNs}.Infrastructure.ExecutionDbContext"),
                (ProgressNs, $"{ProgressNs}.Infrastructure.ProgressDbContext"),
            },
            x =>
            {
                TestResult result = Types
                    .InAssembly(CoreAssembly)
                    .That()
                    .ResideInNamespaceMatching($"^(?!{x.Owner}).*")
                    .And()
                    .DoNotResideInNamespace("ArenaApi.Core")
                    .ShouldNot()
                    .HaveDependencyOn(x.Type)
                    .GetResult();

                Assert.True(
                    result.IsSuccessful,
                    FailingTypesMessage($"{x.Type} referenced outside {x.Owner}", result));
            });
    }

    private static void AssertNoCrossModuleInternalRef(string sourceModule, string[] otherModules)
    {
        foreach (string other in otherModules)
        {
            TestResult result = Types
                .InAssembly(CoreAssembly)
                .That()
                .ResideInNamespaceMatching($@"^{other}\.(?!Public).*")
                .ShouldNot()
                .HaveDependencyOnAny(
                    $"{sourceModule}.Domain",
                    $"{sourceModule}.Infrastructure",
                    $"{sourceModule}.Features")
                .GetResult();

            Assert.True(
                result.IsSuccessful,
                FailingTypesMessage($"{other} depends on {sourceModule} internals", result));
        }
    }

    private static string FailingTypesMessage(string title, TestResult result)
    {
        IEnumerable<string> failing = result.FailingTypeNames ?? [];
        return $"{title}: {string.Join(", ", failing)}";
    }
}
