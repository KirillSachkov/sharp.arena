using ArenaApi.SharedKernel.Outbox;
using Wolverine.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Content.Infrastructure;

internal sealed class ContentOutboxService(IDbContextOutbox<ContentDbContext> outbox) : IOutboxService
{
    public async Task PublishAsync<T>(T message, CancellationToken cancellationToken = default) where T : class
    {
        await outbox.PublishAsync(message).ConfigureAwait(false);
    }
}
