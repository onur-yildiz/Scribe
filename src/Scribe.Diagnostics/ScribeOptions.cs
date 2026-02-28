namespace Scribe.Diagnostics;

/// <summary>
/// Options for configuring Scribe diagnostics persistence.
/// </summary>
public sealed class ScribeOptions
{
    /// <summary>
    /// Gets or sets the MongoDB connection string.
    /// </summary>
    public string ConnectionString { get; set; } = "mongodb://localhost:27017";

    /// <summary>
    /// Gets or sets the target MongoDB database name.
    /// </summary>
    public string DatabaseName { get; set; } = "ScribeDiagnostics";

    /// <summary>
    /// Gets or sets the maximum in-memory queue size used for buffering activity records.
    /// </summary>
    public int MaxQueueCapacity { get; set; } = 10_000;
}
