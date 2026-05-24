using ArenaApi.Modules.Content.Application.Features.CreatePackage;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;

namespace ArenaApi.Modules.Content.Application;

public static class ContentEndpoints
{
    public static IEndpointRouteBuilder MapContentEndpoints(this IEndpointRouteBuilder app)
    {
        RouteGroupBuilder packages = app.MapGroup("/api/packages");
        packages.MapCreatePackage();
        return app;
    }
}
