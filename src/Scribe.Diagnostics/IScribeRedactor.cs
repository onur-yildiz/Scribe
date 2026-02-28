namespace Scribe.Diagnostics;

public interface IScribeRedactor
{
    object? Redact(string key, object? value);
}
