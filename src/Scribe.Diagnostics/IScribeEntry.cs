namespace Scribe.Diagnostics;

public interface IScribeEntry : IDisposable
{
    void Note(string key, string value);
    void AddBaggage(string key, string value);
    void AddEvent(string name, Dictionary<string, object>? tags = null);
    void AttachDump(string key, object? payload);
    void Fault(Exception ex);
}
