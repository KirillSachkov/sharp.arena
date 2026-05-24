namespace ArenaApi.Modules.Progress.Core.Database;

public interface IOutboxService
{
    Task PublishAsync<T>(T message) where T : class;
    Task FlushAsync();
}
