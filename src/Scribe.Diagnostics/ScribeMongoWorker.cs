using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using Scribe.Diagnostics.Models;

namespace Scribe.Diagnostics;

public sealed class ScribeMongoWorker : BackgroundService
{
    private const int BatchSize = 100;
    private static readonly TimeSpan FlushInterval = TimeSpan.FromSeconds(1);
    private const string CollectionName = "ScribeActivities";
    private const int BsonObjectTooLargeErrorCode = 10334;
    private const string DumpErrorFieldName = "__ScribeError";
    private const string PayloadDroppedMessage = "Payload dropped. Exceeded MongoDB 16MB BSON limit.";

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
        try
        {
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
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Host shutdown requested; StopAsync will complete and flush remaining records.
        }

        if (buffer.Count > 0)
            await FlushAsync(buffer, stoppingToken).ConfigureAwait(false);
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        _channel.Complete();

        await base.StopAsync(cancellationToken).ConfigureAwait(false);
        await FlushRemainingAsync(cancellationToken).ConfigureAwait(false);
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
        if (buffer == null || buffer.Count == 0) return;

        var batch = buffer.ToArray();
        buffer.Clear();

        try
        {
            await _collection
                .InsertManyAsync(batch, new InsertManyOptions { IsOrdered = false }, cancellationToken)
                .ConfigureAwait(false);

            return;
        }
        catch (MongoBulkWriteException<MongoActivityRecord> ex)
        {
            var failedIndexes = ex.WriteErrors
                .Select(error => error.Index)
                .Where(index => index >= 0 && index < batch.Length)
                .Distinct()
                .ToArray();

            if (failedIndexes.Length == 0)
            {
                _logger.LogError(
                    ex,
                    "Bulk write failed but no valid failed indexes were reported. BatchSize={BatchSize}",
                    batch.Length);
                return;
            }

            var writeErrorByIndex = ex.WriteErrors
                .GroupBy(error => error.Index)
                .ToDictionary(group => group.Key, group => group.First());

            var retry = new List<MongoActivityRecord>(failedIndexes.Length);
            foreach (var index in failedIndexes)
            {
                var record = batch[index];

                if (writeErrorByIndex.TryGetValue(index, out var writeError) && IsBsonSizeLimitError(writeError))
                {
                    record.Dump ??= new Dictionary<string, BsonValue>();
                    record.Dump.Clear();
                    record.Dump[DumpErrorFieldName] = new BsonString(PayloadDroppedMessage);
                }

                retry.Add(record);
            }

            _logger.LogWarning(
                ex,
                "Bulk write had {FailedCount} failed record(s) out of {BatchSize}; retrying failed records once (unordered).",
                retry.Count,
                batch.Length);

            try
            {
                await _collection
                    .InsertManyAsync(retry, new InsertManyOptions { IsOrdered = false }, cancellationToken)
                    .ConfigureAwait(false);
            }
            catch (MongoBulkWriteException<MongoActivityRecord> retryEx)
            {
                _logger.LogError(
                    retryEx,
                    "Retry bulk write still had failures. RetryCount={RetryCount}, OriginalBatchSize={BatchSize}",
                    retry.Count,
                    batch.Length);
            }
            catch (Exception retryEx)
            {
                _logger.LogError(
                    retryEx,
                    "Retry failed for {RetryCount} activity record(s). OriginalBatchSize={BatchSize}",
                    retry.Count,
                    batch.Length);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to flush {BatchSize} activity record(s) to MongoDB.", batch.Length);
        }
    }

    private async Task FlushRemainingAsync(CancellationToken cancellationToken)
    {
        var buffer = new List<MongoActivityRecord>(BatchSize);

        while (_channel.Reader.TryRead(out var record))
        {
            buffer.Add(record);

            if (buffer.Count >= BatchSize)
                await FlushAsync(buffer, cancellationToken).ConfigureAwait(false);
        }

        if (buffer.Count > 0)
            await FlushAsync(buffer, cancellationToken).ConfigureAwait(false);
    }

    private static bool IsBsonSizeLimitError(WriteError error)
    {
        var message = error.Message ?? string.Empty;
        return error.Code == BsonObjectTooLargeErrorCode ||
               message.Contains("BSONObj size", StringComparison.OrdinalIgnoreCase) ||
               message.Contains("DocumentTooLarge", StringComparison.OrdinalIgnoreCase) ||
               message.Contains("too large", StringComparison.OrdinalIgnoreCase);
    }
}
