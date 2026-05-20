namespace ArenaApi.Contracts.Content;

public sealed record CreatePackageResponse(Guid Id, string Slug, string Title, DateTimeOffset CreatedAt);
