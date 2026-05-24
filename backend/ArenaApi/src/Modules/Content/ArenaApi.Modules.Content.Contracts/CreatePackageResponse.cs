namespace ArenaApi.Modules.Content.Contracts;

public sealed record CreatePackageResponse(Guid Id, string Slug, string Title, DateTimeOffset CreatedAt);
