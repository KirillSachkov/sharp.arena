namespace ArenaApi.Modules.Execution.Core.Database;

public interface IOutboxService
{
    Task PublishAsync<T>(T message) where T : class;
    Task FlushAsync();
}
