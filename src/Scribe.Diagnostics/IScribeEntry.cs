namespace Scribe.Diagnostics;

/// <summary>
/// Represents an operation-scoped diagnostics entry.
/// </summary>
public interface IScribeEntry : IDisposable
{
    /// <summary>
    /// Adds a textual note to the operation.
    /// </summary>
    /// <param name="key">Note key.</param>
    /// <param name="value">Note value.</param>
    void Note(string key, string value);

    /// <summary>
    /// Adds baggage to the underlying activity.
    /// </summary>
    /// <param name="key">Baggage key.</param>
    /// <param name="value">Baggage value.</param>
    void AddBaggage(string key, string value);

    /// <summary>
    /// Adds an activity event with optional tags.
    /// </summary>
    /// <param name="name">Event name.</param>
    /// <param name="tags">Optional event tags.</param>
    void AddEvent(string name, Dictionary<string, object>? tags = null);

    /// <summary>
    /// Attaches a structured payload dump to the entry.
    /// </summary>
    /// <param name="key">Dump key.</param>
    /// <param name="payload">Payload to store.</param>
    void AttachDump(string key, object? payload);

    /// <summary>
    /// Marks the operation as faulted and captures exception details.
    /// </summary>
    /// <param name="ex">Captured exception.</param>
    void Fault(Exception ex);
}
