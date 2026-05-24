namespace ArenaApi.SharedKernel.Outbox;

/// Per-module facade over Wolverine's IDbContextOutbox<TDbContext>. Modules
/// inject this rather than depending on Wolverine types directly, so that
/// the module's DbContext type stays an internal detail.
///
/// Implementations live in each module's Infrastructure/ folder and resolve
/// the correct IDbContextOutbox<TDbContext> via DI.
public interface IOutboxService
{
    Task PublishAsync<T>(T message, CancellationToken cancellationToken = default) where T : class;
}
