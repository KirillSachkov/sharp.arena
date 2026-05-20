namespace ArenaApi.Core.Shared.Errors;

public sealed record Error(string Code, string Message)
{
    public static Error NotFound(string resource, object identifier)
        => new($"{resource}.NotFound", $"{resource} with identifier '{identifier}' was not found.");

    public static Error Conflict(string resource, string message)
        => new($"{resource}.Conflict", message);

    public static Error Validation(string field, string message)
        => new($"Validation.{field}", message);
}
