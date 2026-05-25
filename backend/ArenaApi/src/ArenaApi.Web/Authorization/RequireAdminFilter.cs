using ArenaApi.Core.Modules.IdentityStub.Public;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;

namespace ArenaApi.Web.Authorization;

/// Endpoint filter that 403s any request whose ICurrentUser.IsAdmin is false.
/// Mounted once on the /api/admin route group by ContentModule wiring.
public sealed class RequireAdminFilter(ICurrentUser currentUser) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(
        EndpointFilterInvocationContext context,
        EndpointFilterDelegate next)
    {
        if (!currentUser.IsAdmin)
        {
            return TypedResults.Json(
                new AdminErrorPayload("Forbidden.Admin", "Admin privileges required."),
                statusCode: StatusCodes.Status403Forbidden);
        }

        return await next(context).ConfigureAwait(false);
    }

    public sealed record AdminErrorPayload(string Code, string Message);
}
