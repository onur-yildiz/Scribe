using MongoDB.Bson;
using MongoDB.Driver;
using Scribe.Diagnostics.Models;

namespace Scribe.Diagnostics.Queries;

/// <summary>
/// MongoDB implementation of <see cref="IActivityQueryService"/>.
/// </summary>
public sealed class ActivityQueryService : IActivityQueryService
{
    private const string ServiceTagKeyPrimary = "service.name";
    private const string ServiceTagKeyFallback = "service";

    private readonly IMongoCollection<MongoActivityRecord> _collection;

    public ActivityQueryService(IMongoDatabase database)
    {
        _collection = database.GetCollection<MongoActivityRecord>(MongoCollectionNames.ScribeActivities);
    }

    public async Task<TraceDetailsDto?> GetTraceAsync(string traceId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(traceId))
            return null;

        var records = await _collection
            .Find(x => x.TraceId == traceId)
            .SortBy(x => x.StartTimeUtc)
            .ToListAsync(ct)
            .ConfigureAwait(false);

        if (records.Count == 0)
            return null;

        return new TraceDetailsDto
        {
            Summary = MapSummary(records),
            Spans = records.Select(MapSpan).ToArray()
        };
    }

    public async Task<ActivitySearchResponse> SearchActivitiesAsync(ActivitySearchRequest request, CancellationToken ct)
    {
        var normalizedPage = Math.Max(1, request.Page);
        var normalizedPageSize = Math.Clamp(request.PageSize, 1, 200);

        var filter = BuildFilter(request);
        var grouped = _collection.Aggregate()
            .Match(filter)
            .Group(
                x => x.TraceId,
                g => new TraceGroupProjection
                {
                    TraceId = g.Key,
                    StartTimeUtc = g.Min(x => x.StartTimeUtc),
                    EndTimeUtc = g.Max(x => x.StartTimeUtc + x.Duration),
                    SpanCount = g.Count(),
                    TotalDurationMs = g.Sum(x => x.Duration.TotalMilliseconds),
                    HasError = g.Any(x => x.Status == "Error"),
                    RootOperation = g.First().OperationName
                });

        var totalCountResult = await grouped.Count().FirstOrDefaultAsync(ct).ConfigureAwait(false);
        var totalCount = totalCountResult?.Count ?? 0;

        var items = await grouped
            .SortByDescending(x => x.StartTimeUtc)
            .Skip((normalizedPage - 1) * normalizedPageSize)
            .Limit(normalizedPageSize)
            .ToListAsync(ct)
            .ConfigureAwait(false);

        return new ActivitySearchResponse
        {
            Page = normalizedPage,
            PageSize = normalizedPageSize,
            TotalCount = totalCount,
            Items = items.Select(MapSummary).ToArray()
        };
    }

    private static FilterDefinition<MongoActivityRecord> BuildFilter(ActivitySearchRequest request)
    {
        var builder = Builders<MongoActivityRecord>.Filter;
        var filters = new List<FilterDefinition<MongoActivityRecord>>();

        if (!string.IsNullOrWhiteSpace(request.TraceId))
            filters.Add(builder.Eq(x => x.TraceId, request.TraceId));

        if (!string.IsNullOrWhiteSpace(request.Status))
            filters.Add(builder.Eq(x => x.Status, request.Status));

        if (!string.IsNullOrWhiteSpace(request.OperationName))
            filters.Add(builder.Eq(x => x.OperationName, request.OperationName));

        if (!string.IsNullOrWhiteSpace(request.ServiceName))
        {
            filters.Add(builder.Or(
                builder.Eq($"Tags.{ServiceTagKeyPrimary}", request.ServiceName),
                builder.Eq($"Tags.{ServiceTagKeyFallback}", request.ServiceName)));
        }

        if (request.StartFromUtc.HasValue)
            filters.Add(builder.Gte(x => x.StartTimeUtc, request.StartFromUtc.Value));

        if (request.StartToUtc.HasValue)
            filters.Add(builder.Lte(x => x.StartTimeUtc, request.StartToUtc.Value));

        return filters.Count == 0 ? builder.Empty : builder.And(filters);
    }

    private static ActivitySpanDto MapSpan(MongoActivityRecord record)
    {
        var tags = (record.Tags ?? new Dictionary<string, string>())
            .ToDictionary(
                kvp => kvp.Key,
                kvp => ActivityResponseBounds.Truncate(kvp.Value, ActivityResponseBounds.MaxTagValueLength));

        var events = (record.Events ?? new List<ScribeEventRecord>())
            .Take(ActivityResponseBounds.MaxEventsPerSpan)
            .Select(e => new ActivityEventDto
            {
                Name = ActivityResponseBounds.Truncate(e.Name, ActivityResponseBounds.MaxTagValueLength),
                Timestamp = e.Timestamp,
                Tags = e.Tags.ToDictionary(
                    kvp => kvp.Key,
                    kvp => ActivityResponseBounds.Truncate(Convert.ToString(kvp.Value), ActivityResponseBounds.MaxTagValueLength))
            })
            .ToArray();

        var exceptions = (record.Exceptions ?? new List<ExceptionInfo>())
            .Take(ActivityResponseBounds.MaxExceptionsPerSpan)
            .Select(ex => new ActivityExceptionDto
            {
                Type = ActivityResponseBounds.Truncate(ex.Type, ActivityResponseBounds.MaxTagValueLength),
                Message = ActivityResponseBounds.Truncate(ex.Message, ActivityResponseBounds.MaxExceptionMessageLength),
                StackTrace = string.IsNullOrWhiteSpace(ex.StackTrace)
                    ? null
                    : ActivityResponseBounds.Truncate(ex.StackTrace, ActivityResponseBounds.MaxStackTraceLength),
                Data = ex.Data.ToDictionary(
                    kvp => kvp.Key,
                    kvp => ActivityResponseBounds.Truncate(BsonValue.Create(kvp.Value ?? BsonNull.Value).ToJson(), ActivityResponseBounds.MaxExceptionDataValueLength))
            })
            .ToArray();

        return new ActivitySpanDto
        {
            SpanId = record.SpanId,
            ParentSpanId = record.ParentSpanId,
            Operation = record.OperationName,
            StartTimeUtc = record.StartTimeUtc,
            DurationMs = (long)record.Duration.TotalMilliseconds,
            Status = record.Status,
            Tags = tags,
            Events = events,
            Exceptions = exceptions
        };
    }

    private static TraceSummaryDto MapSummary(IReadOnlyCollection<MongoActivityRecord> records)
    {
        var sorted = records.OrderBy(x => x.StartTimeUtc).ToArray();
        var first = sorted[0];
        var endTime = sorted.Max(x => x.StartTimeUtc + x.Duration);

        return new TraceSummaryDto
        {
            TraceId = first.TraceId,
            RootOperation = first.OperationName,
            Status = records.Any(x => x.Status == "Error") ? "Error" : "Ok",
            StartTimeUtc = first.StartTimeUtc,
            EndTimeUtc = endTime,
            TotalDurationMs = (long)(endTime - first.StartTimeUtc).TotalMilliseconds,
            SpanCount = records.Count
        };
    }

    private static TraceSummaryDto MapSummary(TraceGroupProjection projection) =>
        new()
        {
            TraceId = projection.TraceId,
            RootOperation = projection.RootOperation,
            Status = projection.HasError ? "Error" : "Ok",
            StartTimeUtc = projection.StartTimeUtc,
            EndTimeUtc = projection.EndTimeUtc,
            TotalDurationMs = (long)Math.Max(0, projection.TotalDurationMs),
            SpanCount = projection.SpanCount
        };

    private sealed class TraceGroupProjection
    {
        public string TraceId { get; init; } = string.Empty;
        public string RootOperation { get; init; } = string.Empty;
        public DateTime StartTimeUtc { get; init; }
        public DateTime EndTimeUtc { get; init; }
        public int SpanCount { get; init; }
        public double TotalDurationMs { get; init; }
        public bool HasError { get; init; }
    }
}
