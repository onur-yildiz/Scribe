namespace Scribe.Diagnostics.Queries;

/// <summary>
/// Output size guards for query responses.
/// </summary>
public static class ActivityResponseBounds
{
    public const int MaxTagValueLength = 256;
    public const int MaxExceptionMessageLength = 512;
    public const int MaxStackTraceLength = 2_048;
    public const int MaxExceptionDataValueLength = 512;
    public const int MaxEventsPerSpan = 50;
    public const int MaxExceptionsPerSpan = 10;

    public static string Truncate(string? value, int maxLength)
    {
        if (string.IsNullOrEmpty(value) || value.Length <= maxLength)
            return value ?? string.Empty;

        return value[..Math.Max(0, maxLength - 1)] + "…";
    }
}
