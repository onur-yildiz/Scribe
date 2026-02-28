namespace Scribe.Diagnostics;

/// <summary>
/// Defines a redaction strategy applied to key/value pairs before they are persisted.
/// </summary>
public interface IScribeRedactor
{
    /// <summary>
    /// Redacts or transforms a value associated with the supplied key.
    /// </summary>
    /// <param name="key">The semantic key for the value.</param>
    /// <param name="value">The value to redact.</param>
    /// <returns>The redacted value.</returns>
    object? Redact(string key, object? value);
}
