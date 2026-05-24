using ArenaApi.Modules.Content.Domain.DomainEvents;
using ArenaApi.SharedKernel.DomainEvents;
using ArenaApi.SharedKernel.Errors;
using CSharpFunctionalExtensions;

namespace ArenaApi.Modules.Content.Domain;

public sealed class Package : IHasDomainEvents
{
    private readonly List<IDomainEvent> _domainEvents = [];

    public Guid Id { get; private init; }
    public string Slug { get; private init; } = null!;
    public string Title { get; private init; } = null!;
    public DateTimeOffset CreatedAt { get; private init; }

    public IReadOnlyList<IDomainEvent> DomainEvents => _domainEvents;

    public void ClearDomainEvents() => _domainEvents.Clear();

    private Package() { }   // EF Core

    public static Result<Package, Error> Create(string slug, string title, DateTimeOffset createdAt)
    {
        if (string.IsNullOrWhiteSpace(slug))
        {
            return Error.Validation(nameof(slug), "Slug must not be empty.");
        }

        if (string.IsNullOrWhiteSpace(title))
        {
            return Error.Validation(nameof(title), "Title must not be empty.");
        }

        Package package = new()
        {
            Id = Guid.CreateVersion7(),
            Slug = slug.Trim(),
            Title = title.Trim(),
            CreatedAt = createdAt,
        };

        package._domainEvents.Add(new PackageCreatedDomainEvent(package.Id, package.Slug));
        return package;
    }
}
