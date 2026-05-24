using System.Linq.Expressions;
using ArenaApi.Modules.Content.Core.Database;
using ArenaApi.Modules.Content.Domain;
using ArenaApi.SharedKernel.Errors;
using CSharpFunctionalExtensions;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Modules.Content.Infrastructure.Postgres;

internal sealed class PackagesRepository(ContentDbContext db) : IPackagesRepository
{
    public async Task AddAsync(Package package, CancellationToken cancellationToken = default)
    {
        await db.Packages.AddAsync(package, cancellationToken).ConfigureAwait(false);
    }

    public async Task<Result<Package, Error>> GetByAsync(
        Expression<Func<Package, bool>> predicate,
        CancellationToken cancellationToken = default)
    {
        Package? package = await db.Packages.FirstOrDefaultAsync(predicate, cancellationToken).ConfigureAwait(false);
        return package is null
            ? Error.NotFound("Package", "predicate")
            : package;
    }

    public async Task<IReadOnlyList<Package>> GetManyByAsync(
        Expression<Func<Package, bool>> predicate,
        CancellationToken cancellationToken = default)
    {
        return await db.Packages
            .AsNoTracking()
            .Where(predicate)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    public Task<bool> ExistsAsync(
        Expression<Func<Package, bool>> predicate,
        CancellationToken cancellationToken = default)
    {
        return db.Packages.AnyAsync(predicate, cancellationToken);
    }
}
