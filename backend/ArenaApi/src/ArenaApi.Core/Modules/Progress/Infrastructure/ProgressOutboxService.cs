using ArenaApi.Core.Shared.Outbox;
using Wolverine.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Progress.Infrastructure;

internal sealed class ProgressOutboxService(IDbContextOutbox<ProgressDbContext> outbox) : IOutboxService
{
    public async Task PublishAsync<T>(T message, CancellationToken cancellationToken = default) where T : class
    {
        await outbox.PublishAsync(message).ConfigureAwait(false);
    }
}
