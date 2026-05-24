using ArenaApi.SharedKernel.DomainEvents;

namespace ArenaApi.Core.Modules.Content.Domain.DomainEvents;

internal sealed record PackageCreatedDomainEvent(Guid PackageId, string Slug) : IDomainEvent;
