using System.Linq.Expressions;
using ArenaApi.Modules.Content.Domain;
using ArenaApi.SharedKernel.Errors;
using CSharpFunctionalExtensions;

namespace ArenaApi.Modules.Content.Core.Database;

public interface IPackagesRepository
{
    Task AddAsync(Package package, CancellationToken cancellationToken = default);

    Task<Result<Package, Error>> GetByAsync(
        Expression<Func<Package, bool>> predicate,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Package>> GetManyByAsync(
        Expression<Func<Package, bool>> predicate,
        CancellationToken cancellationToken = default);

    Task<bool> ExistsAsync(
        Expression<Func<Package, bool>> predicate,
        CancellationToken cancellationToken = default);
}
