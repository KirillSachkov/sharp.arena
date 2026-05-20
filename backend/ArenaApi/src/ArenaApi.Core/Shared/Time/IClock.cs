namespace ArenaApi.Core.Shared.Time;

public interface IClock
{
    DateTimeOffset UtcNow { get; }
}
