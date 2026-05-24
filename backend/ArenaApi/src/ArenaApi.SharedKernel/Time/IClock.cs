namespace ArenaApi.SharedKernel.Time;

public interface IClock
{
    DateTimeOffset UtcNow { get; }
}
