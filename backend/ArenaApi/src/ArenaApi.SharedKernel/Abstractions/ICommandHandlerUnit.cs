using ArenaApi.SharedKernel.Errors;
using CSharpFunctionalExtensions;

namespace ArenaApi.SharedKernel.Abstractions;

/// <summary>
/// Command handler that returns only success/failure (no response value).
/// </summary>
public interface ICommandHandlerUnit<in TCommand>
    where TCommand : ICommand
{
    Task<UnitResult<Error>> Handle(TCommand command, CancellationToken cancellationToken = default);
}
