using ArenaApi.SharedKernel.Errors;
using CSharpFunctionalExtensions;

namespace ArenaApi.SharedKernel.Abstractions;

public interface IQueryHandlerWithResult<TResponse, in TQuery>
    where TQuery : IQuery
{
    Task<Result<TResponse, Error>> Handle(TQuery query, CancellationToken cancellationToken = default);
}
