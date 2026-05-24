using ArenaApi.SharedKernel.Outbox;
using Wolverine.EntityFrameworkCore;

namespace ArenaApi.Modules.Progress.Application;

public sealed class ProgressOutboxService(IDbContextOutbox<ProgressDbContext> outbox) : IOutboxService
{
    public async Task PublishAsync<T>(T message, CancellationToken cancellationToken = default) where T : class
    {
        await outbox.PublishAsync(message).ConfigureAwait(false);
    }
}
