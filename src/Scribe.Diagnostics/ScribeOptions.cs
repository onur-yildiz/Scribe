namespace Scribe.Diagnostics;

public sealed class ScribeOptions
{
    public string ConnectionString { get; set; } = "mongodb://localhost:27017";
    public string DatabaseName { get; set; } = "ScribeDiagnostics";
    public int MaxQueueCapacity { get; set; } = 10_000;
}
