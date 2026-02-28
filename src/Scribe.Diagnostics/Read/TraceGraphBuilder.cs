using Scribe.Diagnostics.Models;

namespace Scribe.Diagnostics.Read;

/// <summary>
/// Builds a deterministic trace graph view from a flat list of activity records.
/// </summary>
public static class TraceGraphBuilder
{
    /// <summary>
    /// Converts a collection of trace records into a UI-friendly graph representation.
    /// </summary>
    /// <param name="records">The trace records to convert.</param>
    /// <returns>A normalized trace view.</returns>
    public static TraceView Build(IEnumerable<MongoActivityRecord> records)
    {
        ArgumentNullException.ThrowIfNull(records);

        var orderedRecords = records
            .OrderBy(r => r.StartTimeUtc)
            .ThenBy(r => r.SpanId, StringComparer.Ordinal)
            .ToArray();

        if (orderedRecords.Length == 0)
        {
            return TraceView.Empty;
        }

        var bySpanId = orderedRecords
            .Where(r => !string.IsNullOrWhiteSpace(r.SpanId))
            .GroupBy(r => r.SpanId, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.Ordinal);

        var roots = orderedRecords
            .Where(r => string.IsNullOrWhiteSpace(r.ParentSpanId) || !bySpanId.ContainsKey(r.ParentSpanId))
            .OrderBy(r => r.StartTimeUtc)
            .ThenBy(r => r.SpanId, StringComparer.Ordinal)
            .ToArray();

        var root = roots.FirstOrDefault() ?? orderedRecords[0];
        var traceStart = root.StartTimeUtc;
        var traceEnd = orderedRecords.Max(r => r.StartTimeUtc + r.Duration);
        var totalDurationMs = (traceEnd - traceStart).TotalMilliseconds;

        var depthCache = new Dictionary<string, int>(StringComparer.Ordinal);

        var spanNodes = orderedRecords
            .Select(r => CreateSpanNode(r, bySpanId, depthCache, traceStart))
            .OrderBy(s => s.StartOffsetMs)
            .ThenBy(s => s.Id, StringComparer.Ordinal)
            .ToArray();

        var traceId = orderedRecords.Select(r => r.TraceId).FirstOrDefault(id => !string.IsNullOrWhiteSpace(id)) ?? string.Empty;

        return new TraceView(
            traceId,
            new TraceSummary(
                root.SpanId,
                root.OperationName,
                root.StartTimeUtc,
                Math.Max(totalDurationMs, 0),
                roots.Length),
            spanNodes);
    }

    private static SpanNode CreateSpanNode(
        MongoActivityRecord record,
        IReadOnlyDictionary<string, MongoActivityRecord> bySpanId,
        IDictionary<string, int> depthCache,
        DateTime traceStart)
    {
        var status = DeriveStatus(record);

        return new SpanNode(
            Id: record.SpanId,
            ParentId: string.IsNullOrWhiteSpace(record.ParentSpanId) ? null : record.ParentSpanId,
            Service: GetServiceName(record),
            Operation: record.OperationName,
            DurationMs: Math.Max(record.Duration.TotalMilliseconds, 0),
            StartOffsetMs: (record.StartTimeUtc - traceStart).TotalMilliseconds,
            Depth: ResolveDepth(record, bySpanId, depthCache),
            Status: status,
            AttributesPreview: BuildAttributesPreview(record));
    }

    private static int ResolveDepth(
        MongoActivityRecord record,
        IReadOnlyDictionary<string, MongoActivityRecord> bySpanId,
        IDictionary<string, int> cache)
    {
        if (string.IsNullOrWhiteSpace(record.SpanId))
        {
            return 0;
        }

        if (cache.TryGetValue(record.SpanId, out var cachedDepth))
        {
            return cachedDepth;
        }

        var seen = new HashSet<string>(StringComparer.Ordinal);
        var depth = ComputeDepth(record, bySpanId, cache, seen);
        cache[record.SpanId] = depth;
        return depth;
    }

    private static int ComputeDepth(
        MongoActivityRecord current,
        IReadOnlyDictionary<string, MongoActivityRecord> bySpanId,
        IDictionary<string, int> cache,
        ISet<string> seen)
    {
        if (string.IsNullOrWhiteSpace(current.ParentSpanId))
        {
            return 0;
        }

        if (!seen.Add(current.SpanId))
        {
            return 0;
        }

        if (!bySpanId.TryGetValue(current.ParentSpanId, out var parent))
        {
            return 0;
        }

        if (cache.TryGetValue(parent.SpanId, out var cachedParentDepth))
        {
            return cachedParentDepth + 1;
        }

        var parentDepth = ComputeDepth(parent, bySpanId, cache, seen);
        cache[parent.SpanId] = parentDepth;
        return parentDepth + 1;
    }

    private static SpanStatus DeriveStatus(MongoActivityRecord record)
    {
        var raw = record.Status?.Trim() ?? string.Empty;
        var normalized = string.IsNullOrWhiteSpace(raw) ? "Unset" : raw;
        var hasExceptions = record.Exceptions.Count > 0;

        if (hasExceptions || IsErrorStatus(raw))
        {
            return new SpanStatus(normalized, SpanStatusSeverity.Error, true);
        }

        if (IsWarningStatus(raw))
        {
            return new SpanStatus(normalized, SpanStatusSeverity.Warning, false);
        }

        if (string.Equals(raw, "Ok", StringComparison.OrdinalIgnoreCase))
        {
            return new SpanStatus("Ok", SpanStatusSeverity.Ok, false);
        }

        return new SpanStatus(normalized, SpanStatusSeverity.Unset, false);
    }

    private static bool IsErrorStatus(string? status) =>
        !string.IsNullOrWhiteSpace(status)
        && (status.Contains("error", StringComparison.OrdinalIgnoreCase)
            || status.Contains("fail", StringComparison.OrdinalIgnoreCase)
            || status.Contains("exception", StringComparison.OrdinalIgnoreCase));

    private static bool IsWarningStatus(string? status) =>
        !string.IsNullOrWhiteSpace(status)
        && (status.Contains("warn", StringComparison.OrdinalIgnoreCase)
            || status.Contains("degrad", StringComparison.OrdinalIgnoreCase));

    private static string GetServiceName(MongoActivityRecord record)
    {
        if (record.Tags.TryGetValue("service.name", out var serviceName) && !string.IsNullOrWhiteSpace(serviceName))
        {
            return serviceName;
        }

        if (record.Tags.TryGetValue("peer.service", out var peerService) && !string.IsNullOrWhiteSpace(peerService))
        {
            return peerService;
        }

        return "unknown";
    }

    private static IReadOnlyDictionary<string, string> BuildAttributesPreview(MongoActivityRecord record)
    {
        var preview = new SortedDictionary<string, string>(StringComparer.Ordinal);

        foreach (var (key, value) in record.Tags)
        {
            preview[$"tag.{key}"] = value;
        }

        foreach (var (key, value) in record.Baggage)
        {
            preview[$"baggage.{key}"] = value;
        }

        return preview.Take(5).ToDictionary(kvp => kvp.Key, kvp => kvp.Value, StringComparer.Ordinal);
    }
}

/// <summary>
/// UI model for a trace graph.
/// </summary>
/// <param name="TraceId">Trace identifier.</param>
/// <param name="Summary">High-level trace summary.</param>
/// <param name="Spans">Ordered span nodes for rendering.</param>
public sealed record TraceView(
    string TraceId,
    TraceSummary Summary,
    IReadOnlyList<SpanNode> Spans)
{
    /// <summary>
    /// Gets an empty trace view instance.
    /// </summary>
    public static TraceView Empty { get; } = new(
        string.Empty,
        new TraceSummary(string.Empty, string.Empty, DateTime.MinValue, 0, 0),
        Array.Empty<SpanNode>());
}

/// <summary>
/// High-level summary values for a trace.
/// </summary>
/// <param name="RootSpanId">Root span identifier.</param>
/// <param name="RootOperation">Root operation name.</param>
/// <param name="TraceStartUtc">Root start timestamp in UTC.</param>
/// <param name="TotalDurationMs">Total trace duration in milliseconds.</param>
/// <param name="RootCount">Detected root span count.</param>
public sealed record TraceSummary(
    string RootSpanId,
    string RootOperation,
    DateTime TraceStartUtc,
    double TotalDurationMs,
    int RootCount);

/// <summary>
/// UI model for a single span in a trace graph.
/// </summary>
/// <param name="Id">Span identifier.</param>
/// <param name="ParentId">Parent span identifier.</param>
/// <param name="Service">Service name.</param>
/// <param name="Operation">Operation name.</param>
/// <param name="DurationMs">Duration in milliseconds.</param>
/// <param name="StartOffsetMs">Start offset relative to root in milliseconds.</param>
/// <param name="Depth">Computed graph depth.</param>
/// <param name="Status">Derived status information.</param>
/// <param name="AttributesPreview">Preview subset of attributes for the UI.</param>
public sealed record SpanNode(
    string Id,
    string? ParentId,
    string Service,
    string Operation,
    double DurationMs,
    double StartOffsetMs,
    int Depth,
    SpanStatus Status,
    IReadOnlyDictionary<string, string> AttributesPreview);

/// <summary>
/// Span status information including severity and error markers.
/// </summary>
/// <param name="Value">Original or normalized status value.</param>
/// <param name="Severity">Derived severity level.</param>
/// <param name="IsError">Whether this span should be treated as an error.</param>
public sealed record SpanStatus(string Value, SpanStatusSeverity Severity, bool IsError);

/// <summary>
/// Severity buckets used for UI styling.
/// </summary>
public enum SpanStatusSeverity
{
    /// <summary>
    /// Unknown or unset status.
    /// </summary>
    Unset = 0,

    /// <summary>
    /// Successful status.
    /// </summary>
    Ok = 1,

    /// <summary>
    /// Warning status.
    /// </summary>
    Warning = 2,

    /// <summary>
    /// Error status.
    /// </summary>
    Error = 3
}
