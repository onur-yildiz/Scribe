namespace Scribe.Diagnostics.Models;

public sealed class ScribeEventRecord
{
    public DateTimeOffset Timestamp { get; set; }
    public string Name { get; set; } = string.Empty;
    public Dictionary<string, object> Tags { get; set; } = new();
}
