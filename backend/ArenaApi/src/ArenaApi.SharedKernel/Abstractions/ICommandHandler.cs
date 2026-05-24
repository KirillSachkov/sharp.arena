using ArenaApi.SharedKernel.Errors;
using CSharpFunctionalExtensions;

namespace ArenaApi.SharedKernel.Abstractions;

public interface ICommandHandler<TResponse, in TCommand>
    where TCommand : ICommand
{
    Task<Result<TResponse, Error>> Handle(TCommand command, CancellationToken cancellationToken = default);
}
