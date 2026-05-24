using ArenaApi.Modules.Content.Public.IntegrationEvents;
using Microsoft.Extensions.Logging;

namespace ArenaApi.Modules.Progress.Application.EventHandlers;

/// Phase 0 stub. Listens to PackageCreated published by the Content module
/// and logs that it received it. In later phases this will write a row to
/// arena_progress.package_progress to track per-user enrollment, but the
/// listener wiring is identical — only the body grows.
public static partial class PackageCreatedHandler
{
    public static void Handle(PackageCreated message, ILogger<PackageCreatedHandlerLogCategory> logger)
    {
        LogReceived(logger, message.PackageId, message.Slug);
    }

    [LoggerMessage(
        EventId = 1,
        Level = LogLevel.Information,
        Message = "Progress module received PackageCreated for {PackageId} ({Slug})")]
    private static partial void LogReceived(ILogger logger, Guid packageId, string slug);

    public sealed class PackageCreatedHandlerLogCategory;
}
