using ArenaApi.SharedKernel.Outbox;
using Wolverine.EntityFrameworkCore;

namespace ArenaApi.Modules.Execution.Application;

public sealed class ExecutionOutboxService(IDbContextOutbox<ExecutionDbContext> outbox) : IOutboxService
{
    public async Task PublishAsync<T>(T message, CancellationToken cancellationToken = default) where T : class
    {
        await outbox.PublishAsync(message).ConfigureAwait(false);
    }
}
