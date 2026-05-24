namespace ArenaApi.SharedKernel.DomainEvents;

/// Marker for events raised inside an aggregate and dispatched within the
/// same DB transaction. Domain events never cross module boundaries — use
/// Wolverine integration events for that.
public interface IDomainEvent;
