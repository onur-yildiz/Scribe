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

    public Task<ActivitySearchResponse> SearchActivitiesAsync(ActivitySearchRequest request, CancellationToken ct)
    {
        var normalizedPage = Math.Max(1, request.Page);
        var normalizedPageSize = Math.Clamp(request.PageSize, 1, 200);

        return request.RootOnly
            ? SearchByRootsAsync(request, normalizedPage, normalizedPageSize, ct)
            : SearchByMatchingSpansAsync(request, normalizedPage, normalizedPageSize, ct);
    }

    private async Task<ActivitySearchResponse> SearchByRootsAsync(
        ActivitySearchRequest request,
        int page,
        int pageSize,
        CancellationToken ct)
    {
        var matchedRoots = await _collection
            .Find(BuildFilter(request, rootsOnly: true))
            .ToListAsync(ct)
            .ConfigureAwait(false);

        var matches = matchedRoots
            .Where(x => !string.IsNullOrWhiteSpace(x.TraceId))
            .GroupBy(x => x.TraceId, StringComparer.Ordinal)
            .Select(group =>
            {
                var root = group
                    .OrderBy(x => x.StartTimeUtc)
                    .ThenBy(x => x.SpanId, StringComparer.Ordinal)
                    .First();

                return new TraceMatch(group.Key, root.StartTimeUtc, root);
            })
            .OrderByDescending(x => x.SortStartTimeUtc)
            .ThenBy(x => x.TraceId, StringComparer.Ordinal)
            .ToArray();

        return await BuildSearchResponseAsync(matches, page, pageSize, ct).ConfigureAwait(false);
    }

    private async Task<ActivitySearchResponse> SearchByMatchingSpansAsync(
        ActivitySearchRequest request,
        int page,
        int pageSize,
        CancellationToken ct)
    {
        var matchedRecords = await _collection
            .Find(BuildFilter(request, rootsOnly: false))
            .ToListAsync(ct)
            .ConfigureAwait(false);

        var matches = matchedRecords
            .Where(x => !string.IsNullOrWhiteSpace(x.TraceId))
            .GroupBy(x => x.TraceId, StringComparer.Ordinal)
            .Select(group =>
            {
                var firstMatch = group
                    .OrderBy(x => x.StartTimeUtc)
                    .ThenBy(x => x.SpanId, StringComparer.Ordinal)
                    .First();

                return new TraceMatch(group.Key, firstMatch.StartTimeUtc, null);
            })
            .OrderByDescending(x => x.SortStartTimeUtc)
            .ThenBy(x => x.TraceId, StringComparer.Ordinal)
            .ToArray();

        return await BuildSearchResponseAsync(matches, page, pageSize, ct).ConfigureAwait(false);
    }

    private async Task<ActivitySearchResponse> BuildSearchResponseAsync(
        IReadOnlyList<TraceMatch> matches,
        int page,
        int pageSize,
        CancellationToken ct)
    {
        var pagedMatches = matches
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToArray();

        if (pagedMatches.Length == 0)
        {
            return new ActivitySearchResponse
            {
                Page = page,
                PageSize = pageSize,
                TotalCount = matches.Count,
                Items = Array.Empty<TraceSummaryDto>()
            };
        }

        var traceIds = pagedMatches.Select(x => x.TraceId).ToArray();
        var traceRecords = await _collection
            .Find(Builders<MongoActivityRecord>.Filter.In(x => x.TraceId, traceIds))
            .ToListAsync(ct)
            .ConfigureAwait(false);

        var recordsByTraceId = traceRecords
            .GroupBy(x => x.TraceId, StringComparer.Ordinal)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyCollection<MongoActivityRecord>)group.ToArray(),
                StringComparer.Ordinal);

        var items = pagedMatches
            .Select(match =>
            {
                if (!recordsByTraceId.TryGetValue(match.TraceId, out var records))
                    return null;

                return MapSummary(records, match.RootRecord);
            })
            .Where(summary => summary is not null)
            .Cast<TraceSummaryDto>()
            .ToArray();

        return new ActivitySearchResponse
        {
            Page = page,
            PageSize = pageSize,
            TotalCount = matches.Count,
            Items = items
        };
    }

    private static FilterDefinition<MongoActivityRecord> BuildFilter(ActivitySearchRequest request, bool rootsOnly)
    {
        var builder = Builders<MongoActivityRecord>.Filter;
        var filters = new List<FilterDefinition<MongoActivityRecord>>();

        if (rootsOnly)
        {
            filters.Add(builder.Or(
                builder.Eq(x => x.ParentSpanId, null),
                builder.Eq(x => x.ParentSpanId, string.Empty)));
        }

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

        var dump = MapDump(record.Dump ?? new Dictionary<string, BsonValue>());

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
            ServiceName = GetServiceName(record),
            Operation = record.OperationName,
            StartTimeUtc = record.StartTimeUtc,
            DurationMs = (long)record.Duration.TotalMilliseconds,
            Status = record.Status,
            Tags = tags,
            Dump = dump,
            Events = events,
            Exceptions = exceptions
        };
    }

    private static TraceSummaryDto MapSummary(
        IReadOnlyCollection<MongoActivityRecord> records,
        MongoActivityRecord? preferredRoot = null)
    {
        if (records.Count == 0)
            throw new ArgumentException("At least one record is required.", nameof(records));

        var sorted = records
            .OrderBy(x => x.StartTimeUtc)
            .ThenBy(x => x.SpanId, StringComparer.Ordinal)
            .ToArray();

        var root = preferredRoot is not null && preferredRoot.TraceId == sorted[0].TraceId
            ? preferredRoot
            : ResolveRootRecord(sorted);

        var endTime = sorted.Max(x => x.StartTimeUtc + x.Duration);
        var hasError = sorted.Any(x => x.Exceptions.Count > 0 || IsErrorStatus(x.Status));

        return new TraceSummaryDto
        {
            TraceId = root.TraceId,
            RootSpanId = root.SpanId,
            RootService = GetServiceName(root),
            RootOperation = root.OperationName,
            Status = hasError ? "Error" : "Ok",
            StartTimeUtc = root.StartTimeUtc,
            EndTimeUtc = endTime,
            TotalDurationMs = (long)Math.Max(0, (endTime - root.StartTimeUtc).TotalMilliseconds),
            SpanCount = sorted.Length
        };
    }

    private static MongoActivityRecord ResolveRootRecord(IReadOnlyCollection<MongoActivityRecord> records)
    {
        if (records.Count == 0)
            throw new ArgumentException("At least one record is required.", nameof(records));

        var ordered = records
            .OrderBy(x => x.StartTimeUtc)
            .ThenBy(x => x.SpanId, StringComparer.Ordinal)
            .ToArray();

        var bySpanId = ordered
            .Where(x => !string.IsNullOrWhiteSpace(x.SpanId))
            .GroupBy(x => x.SpanId, StringComparer.Ordinal)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.Ordinal);

        return ordered.FirstOrDefault(record =>
                   string.IsNullOrWhiteSpace(record.ParentSpanId)
                   || !bySpanId.ContainsKey(record.ParentSpanId))
               ?? ordered[0];
    }

    private static IReadOnlyDictionary<string, object?> MapDump(IReadOnlyDictionary<string, BsonValue> dump)
    {
        if (dump.Count == 0)
            return new Dictionary<string, object?>();

        return dump.ToDictionary(
            kvp => kvp.Key,
            kvp => ConvertBsonValue(kvp.Value));
    }

    private static object? ConvertBsonValue(BsonValue? value)
    {
        if (value is null || value.IsBsonNull || value.BsonType == BsonType.Undefined)
            return null;

        return value.BsonType switch
        {
            BsonType.Array => value.AsBsonArray.Select(ConvertBsonValue).ToArray(),
            BsonType.Boolean => value.AsBoolean,
            BsonType.DateTime => value.AsBsonDateTime.ToUniversalTime(),
            BsonType.Decimal128 => ConvertDecimal(value.AsDecimal128),
            BsonType.Document => value.AsBsonDocument.Elements.ToDictionary(
                element => element.Name,
                element => ConvertBsonValue(element.Value)),
            BsonType.Double => value.AsDouble,
            BsonType.Int32 => value.AsInt32,
            BsonType.Int64 => value.AsInt64,
            BsonType.String => value.AsString,
            _ => value.ToString()
        };
    }

    private static object ConvertDecimal(Decimal128 value)
    {
        try
        {
            return Decimal128.ToDecimal(value);
        }
        catch
        {
            return value.ToString();
        }
    }

    private static string GetServiceName(MongoActivityRecord record)
    {
        if (record.Tags.TryGetValue(ServiceTagKeyPrimary, out var primary) && !string.IsNullOrWhiteSpace(primary))
            return primary;

        if (record.Tags.TryGetValue(ServiceTagKeyFallback, out var fallback) && !string.IsNullOrWhiteSpace(fallback))
            return fallback;

        return "unknown";
    }

    private static bool IsErrorStatus(string? status) =>
        !string.IsNullOrWhiteSpace(status)
        && (status.Contains("error", StringComparison.OrdinalIgnoreCase)
            || status.Contains("fail", StringComparison.OrdinalIgnoreCase)
            || status.Contains("exception", StringComparison.OrdinalIgnoreCase));

    private sealed record TraceMatch(
        string TraceId,
        DateTime SortStartTimeUtc,
        MongoActivityRecord? RootRecord);
}
