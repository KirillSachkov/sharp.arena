using Microsoft.AspNetCore.Routing;

namespace ArenaApi.SharedKernel.Endpoints;

public interface IEndpoint
{
    void MapEndpoint(IEndpointRouteBuilder app);
}
