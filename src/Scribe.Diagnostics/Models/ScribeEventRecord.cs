namespace Scribe.Diagnostics.Models;

/// <summary>
/// Represents an activity event captured during an operation.
/// </summary>
public sealed class ScribeEventRecord
{
    /// <summary>
    /// Gets or sets event timestamp.
    /// </summary>
    public DateTimeOffset Timestamp { get; set; }

    /// <summary>
    /// Gets or sets event name.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets event tags.
    /// </summary>
    public Dictionary<string, object> Tags { get; set; } = new();
}
