namespace Scribe.Diagnostics.Queries;

/// <summary>
/// Search filters for reading activity documents.
/// </summary>
public sealed class ActivitySearchRequest
{
    public string? TraceId { get; init; }

    public string? Status { get; init; }

    public string? ServiceName { get; init; }

    public string? OperationName { get; init; }

    public DateTime? StartFromUtc { get; init; }

    public DateTime? StartToUtc { get; init; }

    public int Page { get; init; } = 1;

    public int PageSize { get; init; } = 50;
}
