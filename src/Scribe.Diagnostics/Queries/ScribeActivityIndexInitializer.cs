using Microsoft.Extensions.Hosting;
using MongoDB.Driver;
using Scribe.Diagnostics.Models;

namespace Scribe.Diagnostics.Queries;

/// <summary>
/// Creates required read-side indexes for activity queries.
/// </summary>
public sealed class ScribeActivityIndexInitializer : IHostedService
{
    private readonly IMongoCollection<MongoActivityRecord> _collection;

    public ScribeActivityIndexInitializer(IMongoDatabase database)
    {
        _collection = database.GetCollection<MongoActivityRecord>(MongoCollectionNames.ScribeActivities);
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        var indexBuilder = Builders<MongoActivityRecord>.IndexKeys;

        var models = new[]
        {
            new CreateIndexModel<MongoActivityRecord>(indexBuilder.Ascending(x => x.TraceId)),
            new CreateIndexModel<MongoActivityRecord>(indexBuilder.Descending(x => x.StartTimeUtc)),
            new CreateIndexModel<MongoActivityRecord>(indexBuilder.Ascending(x => x.Status)),
            new CreateIndexModel<MongoActivityRecord>(indexBuilder.Ascending(x => x.OperationName))
        };

        await _collection.Indexes.CreateManyAsync(models, cancellationToken).ConfigureAwait(false);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
