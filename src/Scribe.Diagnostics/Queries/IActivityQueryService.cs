namespace Scribe.Diagnostics.Queries;

/// <summary>
/// Read-side query abstraction for persisted activity records.
/// </summary>
public interface IActivityQueryService
{
    /// <summary>
    /// Returns a complete trace by trace id.
    /// </summary>
    Task<TraceDetailsDto?> GetTraceAsync(string traceId, CancellationToken ct);

    /// <summary>
    /// Searches traces with filters and pagination.
    /// </summary>
    Task<ActivitySearchResponse> SearchActivitiesAsync(ActivitySearchRequest request, CancellationToken ct);
}
