namespace Scribe.Diagnostics;

public interface IScribeEntry : IDisposable
{
    void Note(string key, string value);
    void AttachDump(string key, object? payload);
    void Fault(Exception ex);
}
