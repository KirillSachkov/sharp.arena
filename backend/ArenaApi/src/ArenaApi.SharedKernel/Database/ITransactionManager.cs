using System.Data.Common;
using ArenaApi.SharedKernel.Errors;
using CSharpFunctionalExtensions;

namespace ArenaApi.SharedKernel.Database;

/// <summary>
/// Manages database transactions and change persistence. Scoped per request.
///
/// Two usage modes:
/// 1. Auto — call SaveChangesAsync() without BeginTransactionAsync().
///    The ORM/outbox commits and flushes messages atomically.
/// 2. Manual — BeginTransactionAsync() → SaveChangesAsync() (1+ times) → CommitTransactionAsync().
///    Rollback happens on Dispose if not committed.
/// </summary>
public interface ITransactionManager : IAsyncDisposable
{
    Task<UnitResult<Error>> BeginTransactionAsync(CancellationToken cancellationToken = default);

    Task<UnitResult<Error>> SaveChangesAsync(CancellationToken cancellationToken = default);

    Task<UnitResult<Error>> CommitTransactionAsync(CancellationToken cancellationToken = default);

    /// Underlying DB connection for raw SQL / Dapper queries.
    DbConnection GetDbConnection();
}
