using ArenaApi.Core.Modules.Content.Public;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Core.Modules.Content.Infrastructure;

internal sealed class ContentReader(ContentDbContext db) : IContentReader
{
    public Task<PackageView?> GetPackageAsync(Guid packageId, CancellationToken cancellationToken = default)
    {
        return db.Packages
            .AsNoTracking()
            .Where(p => p.Id == packageId)
            .Select(p => new PackageView(p.Id, p.Slug, p.Title, p.CreatedAt))
            .FirstOrDefaultAsync(cancellationToken);
    }
}
