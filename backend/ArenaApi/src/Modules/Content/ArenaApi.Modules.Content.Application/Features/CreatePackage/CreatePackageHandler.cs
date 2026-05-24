using ArenaApi.Modules.Content.Domain;
using ArenaApi.Modules.Content.Public;
using ArenaApi.Modules.Content.Public.IntegrationEvents;
using ArenaApi.SharedKernel.Errors;
using ArenaApi.SharedKernel.Time;
using CSharpFunctionalExtensions;
using Microsoft.EntityFrameworkCore;

namespace ArenaApi.Modules.Content.Application.Features.CreatePackage;

public sealed class CreatePackageHandler(
    ContentDbContext db,
    ContentOutboxService outbox,
    IClock clock)
{
    public async Task<Result<PackageView, Error>> HandleAsync(
        CreatePackageCommand command,
        CancellationToken cancellationToken)
    {
        bool slugTaken = await db.Packages
            .AsNoTracking()
            .AnyAsync(p => p.Slug == command.Slug, cancellationToken)
            .ConfigureAwait(false);

        if (slugTaken)
        {
            return Error.Conflict("Package", $"Slug '{command.Slug}' is already in use.");
        }

        Result<Package, Error> packageResult = Package.Create(command.Slug, command.Title, clock.UtcNow);
        if (packageResult.IsFailure)
        {
            return packageResult.Error;
        }

        Package package = packageResult.Value;

        await db.Packages.AddAsync(package, cancellationToken).ConfigureAwait(false);

        await outbox.PublishAsync(
            new PackageCreated(package.Id, package.Slug, package.Title, package.CreatedAt),
            cancellationToken)
            .ConfigureAwait(false);

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        return new PackageView(package.Id, package.Slug, package.Title, package.CreatedAt);
    }
}
