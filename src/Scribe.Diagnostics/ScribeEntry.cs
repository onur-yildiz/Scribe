using System.Diagnostics;
using Scribe.Diagnostics.Models;

namespace Scribe.Diagnostics;

public sealed class ScribeEntry : IScribeEntry
{
    private static readonly ActivitySource _source = new("Scribe.Diagnostics");

    private readonly Activity? _activity;
    private readonly MongoActivityRecord _record;
    private readonly ScribeChannel _channel;
    private bool _disposed;

    public ScribeEntry(string operationName, ScribeChannel channel)
    {
        _channel = channel;
        _activity = _source.StartActivity(operationName);

        _record = new MongoActivityRecord
        {
            TraceId = _activity?.TraceId.ToString() ?? Activity.Current?.TraceId.ToString() ?? string.Empty,
            SpanId = _activity?.SpanId.ToString() ?? Activity.Current?.SpanId.ToString() ?? string.Empty,
            ParentSpanId = _activity?.ParentSpanId.ToString(),
            OperationName = operationName,
            StartTimeUtc = DateTime.UtcNow
        };
    }

    public void Note(string key, string value)
    {
        _activity?.SetTag(key, value);
        _record.Tags[key] = value;
    }

    public void AttachDump(string key, object payload) =>
        _record.Dump[key] = payload;

    public void Fault(Exception ex)
    {
        _activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
        _record.Status = "Error";
        _record.Exceptions.Add(new ExceptionInfo
        {
            Type = ex.GetType().FullName ?? ex.GetType().Name,
            Message = ex.Message,
            StackTrace = ex.StackTrace
        });
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        _record.Duration = DateTime.UtcNow - _record.StartTimeUtc;
        _activity?.Stop();
        _activity?.Dispose();

        _channel.Enqueue(_record);
    }
}
