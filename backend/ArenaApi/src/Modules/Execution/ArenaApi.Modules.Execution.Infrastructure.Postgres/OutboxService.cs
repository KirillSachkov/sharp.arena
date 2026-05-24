using ArenaApi.Modules.Execution.Core.Database;
using Wolverine.EntityFrameworkCore;

namespace ArenaApi.Modules.Execution.Infrastructure.Postgres;

internal sealed class OutboxService(IDbContextOutbox<ExecutionDbContext> outbox) : IOutboxService
{
    public Task FlushAsync() => outbox.FlushOutgoingMessagesAsync();

    public async Task PublishAsync<T>(T message) where T : class
    {
        await outbox.PublishAsync(message).ConfigureAwait(false);
    }
}
