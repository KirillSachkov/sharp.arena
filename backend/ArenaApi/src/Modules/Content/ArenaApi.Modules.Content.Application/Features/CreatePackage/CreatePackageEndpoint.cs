using ArenaApi.Contracts.Content;
using ArenaApi.Modules.Content.Public;
using ArenaApi.SharedKernel.Errors;
using CSharpFunctionalExtensions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;

namespace ArenaApi.Modules.Content.Application.Features.CreatePackage;

internal static class CreatePackageEndpoint
{
    public static IEndpointRouteBuilder MapCreatePackage(this IEndpointRouteBuilder group)
    {
        group.MapPost("/", HandleAsync)
            .WithName("CreatePackage")
            .WithTags("Content");
        return group;
    }

    private static async Task<Results<Created<CreatePackageResponse>, Conflict<ErrorPayload>, BadRequest<ErrorPayload>>> HandleAsync(
        CreatePackageRequest request,
        CreatePackageHandler handler,
        CancellationToken cancellationToken)
    {
        Result<PackageView, Error> result = await handler
            .HandleAsync(new CreatePackageCommand(request.Slug, request.Title), cancellationToken)
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
