using System.Data.Common;
using ArenaApi.SharedKernel.Errors;
using CSharpFunctionalExtensions;

namespace ArenaApi.Modules.Progress.Core.Database;

/// Module-scoped transaction manager. Each module defines its own
/// ITransactionManager interface so that DI registration in the single
/// monolith container doesn't collide across modules (last-wins would
/// otherwise resolve the wrong DbContext type).
///
/// Two usage modes:
/// 1. Auto — SaveChangesAsync() without BeginTransactionAsync().
///    The ORM/outbox commits and flushes messages atomically.
/// 2. Manual — BeginTransactionAsync() → SaveChangesAsync() (1+ times) → CommitTransactionAsync().
///    Rollback happens on Dispose if not committed.
public interface ITransactionManager : IAsyncDisposable
{
    Task<UnitResult<Error>> BeginTransactionAsync(CancellationToken cancellationToken = default);

    Task<UnitResult<Error>> SaveChangesAsync(CancellationToken cancellationToken = default);

    Task<UnitResult<Error>> CommitTransactionAsync(CancellationToken cancellationToken = default);

    /// Underlying DB connection for raw SQL / Dapper queries.
    DbConnection GetDbConnection();
}
