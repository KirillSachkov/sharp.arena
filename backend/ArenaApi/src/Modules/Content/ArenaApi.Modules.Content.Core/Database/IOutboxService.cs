namespace ArenaApi.Modules.Content.Core.Database;

/// Thin wrapper over Wolverine's IDbContextOutbox<ContentDbContext>. Handlers
/// depend on this module-scoped interface (not Wolverine types directly).
public interface IOutboxService
{
    Task PublishAsync<T>(T message) where T : class;

    Task FlushAsync();
}
