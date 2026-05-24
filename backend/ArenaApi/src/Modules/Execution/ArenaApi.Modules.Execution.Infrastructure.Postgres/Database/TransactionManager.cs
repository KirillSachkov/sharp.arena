using System.Data;
using System.Data.Common;
using ArenaApi.SharedKernel.Database;
using ArenaApi.SharedKernel.Errors;
using CSharpFunctionalExtensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Logging;
using Wolverine.EntityFrameworkCore;

namespace ArenaApi.Modules.Execution.Infrastructure.Postgres.Database;

internal sealed class TransactionManager(
    IDbContextOutbox<ExecutionDbContext> outbox,
    ILogger<TransactionManager> logger) : ITransactionManager, IDisposable
{
    private IDbContextTransaction? _currentTransaction;

    public async Task<UnitResult<Error>> BeginTransactionAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            _currentTransaction = await outbox.DbContext.Database
                .BeginTransactionAsync(cancellationToken)
                .ConfigureAwait(false);
            return UnitResult.Success<Error>();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to begin transaction");
            return Error.Validation("transaction", "Failed to begin transaction.");
        }
    }

    public async Task<UnitResult<Error>> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            if (_currentTransaction is not null)
            {
                await outbox.DbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            }
            else
            {
                await outbox.SaveChangesAndFlushMessagesAsync(cancellationToken).ConfigureAwait(false);
            }

            return UnitResult.Success<Error>();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "SaveChanges failed");
            return Error.Validation("transaction", "Persistence failed.");
        }
    }

    public async Task<UnitResult<Error>> CommitTransactionAsync(CancellationToken cancellationToken = default)
    {
        if (_currentTransaction is null)
        {
            return Error.Validation("transaction", "No active transaction.");
        }

        try
        {
            await outbox.DbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            await _currentTransaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            await outbox.FlushOutgoingMessagesAsync().ConfigureAwait(false);
            return UnitResult.Success<Error>();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Commit failed");
            await RollbackAsync(cancellationToken).ConfigureAwait(false);
            return Error.Validation("transaction", "Commit failed.");
        }
        finally
        {
            await DisposeTransactionAsync().ConfigureAwait(false);
        }
    }

    public DbConnection GetDbConnection()
    {
        DbConnection connection = outbox.DbContext.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
        {
            connection.Open();
        }
        return connection;
    }

    public async ValueTask DisposeAsync() => await DisposeTransactionAsync().ConfigureAwait(false);

    public void Dispose()
    {
        _currentTransaction?.Dispose();
        _currentTransaction = null;
    }

    private async Task RollbackAsync(CancellationToken cancellationToken)
    {
        try
        {
            if (_currentTransaction is not null)
            {
                await _currentTransaction.RollbackAsync(cancellationToken).ConfigureAwait(false);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Rollback failed");
        }
    }

    private async Task DisposeTransactionAsync()
    {
        if (_currentTransaction is not null)
        {
            await _currentTransaction.DisposeAsync().ConfigureAwait(false);
            _currentTransaction = null;
        }
    }
}
