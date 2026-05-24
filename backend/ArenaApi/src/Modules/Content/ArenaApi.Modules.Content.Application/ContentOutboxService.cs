using ArenaApi.SharedKernel.Outbox;
using Wolverine.EntityFrameworkCore;

namespace ArenaApi.Modules.Content.Application;

public sealed class ContentOutboxService(IDbContextOutbox<ContentDbContext> outbox) : IOutboxService
{
    public async Task PublishAsync<T>(T message, CancellationToken cancellationToken = default) where T : class
    {
        await outbox.PublishAsync(message).ConfigureAwait(false);
    }
}
