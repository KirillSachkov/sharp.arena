using ArenaApi.Modules.Progress.Core.Database;
using Wolverine.EntityFrameworkCore;

namespace ArenaApi.Modules.Progress.Infrastructure.Postgres;

internal sealed class OutboxService(IDbContextOutbox<ProgressDbContext> outbox) : IOutboxService
{
    public Task FlushAsync() => outbox.FlushOutgoingMessagesAsync();

    public async Task PublishAsync<T>(T message) where T : class
    {
        await outbox.PublishAsync(message).ConfigureAwait(false);
    }
}
