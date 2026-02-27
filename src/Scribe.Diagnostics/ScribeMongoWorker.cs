using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;
using Scribe.Diagnostics.Models;

namespace Scribe.Diagnostics;

public sealed class ScribeMongoWorker : BackgroundService
{
    private const int BatchSize = 100;
    private static readonly TimeSpan FlushInterval = TimeSpan.FromSeconds(1);
    private const string CollectionName = "ScribeActivities";

    private readonly ScribeChannel _channel;
    private readonly IMongoCollection<MongoActivityRecord> _collection;
    private readonly ILogger<ScribeMongoWorker> _logger;

    public ScribeMongoWorker(ScribeChannel channel, IMongoDatabase database, ILogger<ScribeMongoWorker> logger)
    {
        _channel = channel;
        _collection = database.GetCollection<MongoActivityRecord>(CollectionName);
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var buffer = new List<MongoActivityRecord>(BatchSize);

        await foreach (var record in _channel.Reader.ReadAllAsync(stoppingToken).ConfigureAwait(false))
        {
            buffer.Add(record);

            if (buffer.Count >= BatchSize)
            {
                await FlushAsync(buffer, stoppingToken).ConfigureAwait(false);
                continue;
            }

            // Drain remaining items available right now without waiting
            while (buffer.Count < BatchSize && _channel.Reader.TryRead(out var extra))
                buffer.Add(extra);

            if (buffer.Count >= BatchSize || !await WaitForMoreAsync(stoppingToken).ConfigureAwait(false))
                await FlushAsync(buffer, stoppingToken).ConfigureAwait(false);
        }

        // Flush anything left after the channel is completed
        if (buffer.Count > 0)
            await FlushAsync(buffer, CancellationToken.None).ConfigureAwait(false);

        // Drain any remaining items written before Complete() was called
        while (_channel.Reader.TryRead(out var remaining))
        {
            buffer.Add(remaining);
            if (buffer.Count >= BatchSize)
                await FlushAsync(buffer, CancellationToken.None).ConfigureAwait(false);
        }

        if (buffer.Count > 0)
            await FlushAsync(buffer, CancellationToken.None).ConfigureAwait(false);
    }

    private async Task<bool> WaitForMoreAsync(CancellationToken stoppingToken)
    {
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
        cts.CancelAfter(FlushInterval);
        try
        {
            return await _channel.Reader.WaitToReadAsync(cts.Token).ConfigureAwait(false);
        }
        catch (OperationCanceledException)
        {
            return false;
        }
    }

    private async Task FlushAsync(List<MongoActivityRecord> buffer, CancellationToken cancellationToken)
    {
        if (buffer.Count == 0) return;
        try
        {
            await _collection.InsertManyAsync(buffer, cancellationToken: cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to flush {Count} activity record(s) to MongoDB.", buffer.Count);
        }
        finally
        {
            buffer.Clear();
        }
    }
}
