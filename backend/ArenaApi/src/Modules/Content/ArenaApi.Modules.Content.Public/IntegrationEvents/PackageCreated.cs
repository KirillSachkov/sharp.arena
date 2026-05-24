namespace ArenaApi.Modules.Content.Public.IntegrationEvents;

/// Published via Wolverine + RabbitMQ when a Package row is committed.
/// Other modules subscribe by writing an `IWolverineHandler` method that
/// accepts this type.
public sealed record PackageCreated(Guid PackageId, string Slug, string Title, DateTimeOffset CreatedAt);
