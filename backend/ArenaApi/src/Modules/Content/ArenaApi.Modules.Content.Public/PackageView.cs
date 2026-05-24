namespace ArenaApi.Modules.Content.Public;

/// Immutable cross-module projection of a Package. Anything other modules
/// need to know about a package goes here; the internal Domain.Package may
/// hold more fields, but those never leak across the boundary.
public sealed record PackageView(Guid Id, string Slug, string Title, DateTimeOffset CreatedAt);
