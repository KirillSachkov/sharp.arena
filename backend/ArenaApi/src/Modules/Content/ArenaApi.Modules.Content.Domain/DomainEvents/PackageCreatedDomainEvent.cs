using ArenaApi.SharedKernel.DomainEvents;

namespace ArenaApi.Modules.Content.Domain.DomainEvents;

internal sealed record PackageCreatedDomainEvent(Guid PackageId, string Slug) : IDomainEvent;
