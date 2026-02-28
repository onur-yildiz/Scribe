namespace Scribe.Diagnostics.Queries;

/// <summary>
/// Query response for activity searches.
/// </summary>
public sealed class ActivitySearchResponse
{
    public required int Page { get; init; }

    public required int PageSize { get; init; }

    public required long TotalCount { get; init; }

    public required IReadOnlyCollection<TraceSummaryDto> Items { get; init; }
}

/// <summary>
/// Aggregate details for a trace.
/// </summary>
public sealed class TraceDetailsDto
{
    public required TraceSummaryDto Summary { get; init; }

    public required IReadOnlyCollection<ActivitySpanDto> Spans { get; init; }
}

/// <summary>
/// Summary details for a trace list item.
/// </summary>
public sealed class TraceSummaryDto
{
    public required string TraceId { get; init; }

    public required long TotalDurationMs { get; init; }

    public required string RootOperation { get; init; }

    public required string Status { get; init; }

    public required DateTime StartTimeUtc { get; init; }

    public required DateTime EndTimeUtc { get; init; }

    public required int SpanCount { get; init; }
}

/// <summary>
/// Span-level details for a specific trace.
/// </summary>
public sealed class ActivitySpanDto
{
    public required string SpanId { get; init; }

    public string? ParentSpanId { get; init; }

    public required string Operation { get; init; }

    public required DateTime StartTimeUtc { get; init; }

    public required long DurationMs { get; init; }

    public required string Status { get; init; }

    public required IReadOnlyDictionary<string, string> Tags { get; init; }

    public required IReadOnlyCollection<ActivityEventDto> Events { get; init; }

    public required IReadOnlyCollection<ActivityExceptionDto> Exceptions { get; init; }
}

public sealed class ActivityEventDto
{
    public required string Name { get; init; }

    public required DateTimeOffset Timestamp { get; init; }

    public required IReadOnlyDictionary<string, string> Tags { get; init; }
}

public sealed class ActivityExceptionDto
{
    public required string Type { get; init; }

    public required string Message { get; init; }

    public string? StackTrace { get; init; }

    public required IReadOnlyDictionary<string, string> Data { get; init; }
}
