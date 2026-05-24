// Use-case-as-single-file: Endpoint + Command + Validator + Handler in one file.
// Suppresses MA0048 (file name must match type name) — intentional pattern.
#pragma warning disable MA0048
using ArenaApi.Modules.Content.Contracts;
using ArenaApi.Modules.Content.Contracts.IntegrationEvents;
using ArenaApi.Modules.Content.Core.Database;
using ArenaApi.Modules.Content.Domain;
using ArenaApi.SharedKernel.Abstractions;
using ArenaApi.SharedKernel.Database;
using ArenaApi.SharedKernel.Endpoints;
using ArenaApi.SharedKernel.Errors;
using ArenaApi.SharedKernel.Time;
using CSharpFunctionalExtensions;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace ArenaApi.Modules.Content.Core.Features.Packages.UseCases;

public sealed class CreatePackageEndpoint : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/packages/", HandleAsync)
            .WithName("CreatePackage")
            .WithTags("Content");
    }

    private static async Task<Results<Created<CreatePackageResponse>, Conflict<ErrorPayload>, BadRequest<ErrorPayload>>> HandleAsync(
        [FromBody] CreatePackageRequest request,
        [FromServices] CreatePackageHandler handler,
        CancellationToken cancellationToken)
    {
        Result<PackageView, Error> result = await handler
            .Handle(new CreatePackageCommand(request.Slug, request.Title), cancellationToken)
            .ConfigureAwait(false);

        if (result.IsFailure)
        {
            ErrorPayload payload = new(result.Error.Code, result.Error.Message);
            return result.Error.Code.EndsWith("Conflict", StringComparison.Ordinal)
                ? TypedResults.Conflict(payload)
                : TypedResults.BadRequest(payload);
        }

        PackageView view = result.Value;
        CreatePackageResponse body = new(view.Id, view.Slug, view.Title, view.CreatedAt);
        return TypedResults.Created($"/api/packages/{view.Id}/", body);
    }

    internal sealed record ErrorPayload(string Code, string Message);
}

public sealed record CreatePackageCommand(string Slug, string Title) : ICommand;

public sealed class CreatePackageValidator : AbstractValidator<CreatePackageCommand>
{
    public CreatePackageValidator()
    {
        RuleFor(x => x.Slug)
            .NotEmpty().WithMessage("Slug must not be empty.")
            .MaximumLength(120).WithMessage("Slug must be 120 characters or fewer.");

        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Title must not be empty.")
            .MaximumLength(200).WithMessage("Title must be 200 characters or fewer.");
    }
}

public sealed class CreatePackageHandler(
    IPackagesRepository packages,
    IValidator<CreatePackageCommand> validator,
    IOutboxService outbox,
    ITransactionManager transactions,
    IClock clock) : ICommandHandler<PackageView, CreatePackageCommand>
{
    public async Task<Result<PackageView, Error>> Handle(
        CreatePackageCommand command,
        CancellationToken cancellationToken = default)
    {
        ValidationResult validation = await validator.ValidateAsync(command, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            ValidationFailure first = validation.Errors[0];
            return Error.Validation(first.PropertyName, first.ErrorMessage);
        }

        bool slugTaken = await packages
            .ExistsAsync(p => p.Slug == command.Slug, cancellationToken)
            .ConfigureAwait(false);

        if (slugTaken)
        {
            return Error.Conflict("Package", $"Slug '{command.Slug}' is already in use.");
        }

        Result<Package, Error> create = Package.Create(command.Slug, command.Title, clock.UtcNow);
        if (create.IsFailure)
        {
            return create.Error;
        }

        Package package = create.Value;

        await packages.AddAsync(package, cancellationToken).ConfigureAwait(false);
        await outbox.PublishAsync(new PackageCreated(package.Id, package.Slug, package.Title, package.CreatedAt)).ConfigureAwait(false);

        UnitResult<Error> save = await transactions.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        if (save.IsFailure)
        {
            return save.Error;
        }

        return new PackageView(package.Id, package.Slug, package.Title, package.CreatedAt);
    }
}
