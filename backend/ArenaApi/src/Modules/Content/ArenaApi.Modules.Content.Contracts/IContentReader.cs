namespace ArenaApi.Modules.Content.Contracts;

/// Sync read contract for other modules. Implementation lives in
/// Content/Infrastructure/ContentReader.cs and queries ContentDbContext.
public interface IContentReader
{
    Task<PackageView?> GetPackageAsync(Guid packageId, CancellationToken cancellationToken = default);
}
