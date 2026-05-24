using ArenaApi.Modules.Content.Core.Database;
using Wolverine.EntityFrameworkCore;

namespace ArenaApi.Modules.Content.Infrastructure.Postgres;

internal sealed class OutboxService(IDbContextOutbox<ContentDbContext> outbox) : IOutboxService
{
    public Task FlushAsync() => outbox.FlushOutgoingMessagesAsync();

    public async Task PublishAsync<T>(T message) where T : class
    {
        await outbox.PublishAsync(message).ConfigureAwait(false);
    }
}
