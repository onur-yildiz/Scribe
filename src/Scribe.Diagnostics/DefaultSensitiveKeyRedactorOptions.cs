namespace Scribe.Diagnostics;

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

    public IReadOnlySet<string> SensitiveKeys => _sensitiveKeys;

    public DefaultSensitiveKeyRedactorOptions AddSensitiveKey(string key)
    {
        if (!string.IsNullOrWhiteSpace(key))
            _sensitiveKeys.Add(key);

        return this;
    }

    public DefaultSensitiveKeyRedactorOptions RemoveSensitiveKey(string key)
    {
        if (!string.IsNullOrWhiteSpace(key))
            _sensitiveKeys.Remove(key);

        return this;
    }

    public DefaultSensitiveKeyRedactorOptions ClearSensitiveKeys()
    {
        _sensitiveKeys.Clear();
        return this;
    }
}
