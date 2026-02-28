namespace Scribe.Diagnostics;

/// <summary>
/// Options for the built-in sensitive-key redactor.
/// </summary>
public sealed class DefaultSensitiveKeyRedactorOptions
{
    private static readonly string[] _defaultSensitiveKeys =
    [
        "password",
        "passwd",
        "pwd",
        "secret",
        "client_secret",
        "token",
        "access_token",
        "refresh_token",
        "auth_token",
        "api_key",
        "apikey",
        "session_id",
        "bearer",
        "credential",
        "passphrase",
        "private_key",
        "public_key",
        "salt",
        "hash",
        "signature",
        "certificate",
        "cert",
        "authorization",
        "ssn"
    ];

    private readonly HashSet<string> _sensitiveKeys = new(_defaultSensitiveKeys, StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// Gets the current sensitive key set.
    /// </summary>
    public IReadOnlySet<string> SensitiveKeys => _sensitiveKeys;

    /// <summary>
    /// Adds a key to the sensitive key set.
    /// </summary>
    /// <param name="key">Key to mark as sensitive.</param>
    /// <returns>The current options instance.</returns>
    public DefaultSensitiveKeyRedactorOptions AddSensitiveKey(string key)
    {
        if (!string.IsNullOrWhiteSpace(key))
            _sensitiveKeys.Add(key);

        return this;
    }

    /// <summary>
    /// Removes a key from the sensitive key set.
    /// </summary>
    /// <param name="key">Key to remove.</param>
    /// <returns>The current options instance.</returns>
    public DefaultSensitiveKeyRedactorOptions RemoveSensitiveKey(string key)
    {
        if (!string.IsNullOrWhiteSpace(key))
            _sensitiveKeys.Remove(key);

        return this;
    }

    /// <summary>
    /// Clears all configured sensitive keys.
    /// </summary>
    /// <returns>The current options instance.</returns>
    public DefaultSensitiveKeyRedactorOptions ClearSensitiveKeys()
    {
        _sensitiveKeys.Clear();
        return this;
    }
}
