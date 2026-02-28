namespace Scribe.Diagnostics;

/// <summary>
/// Redacts values whose keys are configured as sensitive.
/// </summary>
public sealed class DefaultSensitiveKeyRedactor : IScribeRedactor
{
    private readonly HashSet<string> _sensitiveKeys;

    /// <summary>
    /// Initializes a new redactor instance from options.
    /// </summary>
    /// <param name="options">Redaction options.</param>
    public DefaultSensitiveKeyRedactor(DefaultSensitiveKeyRedactorOptions options)
    {
        _sensitiveKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var key in options.SensitiveKeys)
        {
            var normalizedKey = NormalizeKey(key);
            if (normalizedKey.Length > 0)
                _sensitiveKeys.Add(normalizedKey);
        }
    }

    /// <inheritdoc />
    public object? Redact(string key, object? value) =>
        _sensitiveKeys.Contains(NormalizeKey(key)) ? "[*** REDACTED ***]" : value;

    private static string NormalizeKey(string key)
    {
        if (string.IsNullOrWhiteSpace(key)) return string.Empty;

        return new string(key
            .Where(char.IsLetterOrDigit)
            .ToArray());
    }
}
