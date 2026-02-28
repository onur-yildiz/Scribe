using System.Diagnostics;
using System.Text.Json;
using System.Text.Json.Serialization;
using MongoDB.Bson;
using Scribe.Diagnostics.Models;

namespace Scribe.Diagnostics;

public sealed class ScribeEntry : IScribeEntry
{
    private static readonly ActivitySource _source = new("Scribe.Diagnostics");
    private static readonly JsonSerializerOptions _dumpJsonOptions = new()
    {
        ReferenceHandler = ReferenceHandler.IgnoreCycles
    };

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

    public void AttachDump(string key, object? payload) =>
        _record.Dump[key] = ToBsonValue(payload);

    private static BsonValue ToBsonValue(object? payload)
    {
        if (payload is null) return BsonNull.Value;
        if (payload is BsonValue bsonValue) return bsonValue;

        try
        {
            return BsonValue.Create(payload);
        }
        catch
        {
            try
            {
                var jsonElement = JsonSerializer.SerializeToElement(payload, _dumpJsonOptions);
                return ToBsonValue(jsonElement);
            }
            catch
            {
                var fallback = payload.GetType().FullName is { Length: > 0 } fullName
                    ? $"{fullName}: {payload}"
                    : payload.ToString() ?? string.Empty;

                return new BsonString(fallback);
            }
        }
    }

    private static BsonValue ToBsonValue(JsonElement element) =>
        element.ValueKind switch
        {
            JsonValueKind.Object => new BsonDocument(element.EnumerateObject()
                .Select(prop => new BsonElement(prop.Name, ToBsonValue(prop.Value)))),
            JsonValueKind.Array => new BsonArray(element.EnumerateArray().Select(ToBsonValue)),
            JsonValueKind.String => new BsonString(element.GetString() ?? string.Empty),
            JsonValueKind.Number when element.TryGetInt32(out var i) => new BsonInt32(i),
            JsonValueKind.Number when element.TryGetInt64(out var l) => new BsonInt64(l),
            JsonValueKind.Number when element.TryGetDecimal(out var d) => new BsonDecimal128(d),
            JsonValueKind.Number => new BsonDouble(element.GetDouble()),
            JsonValueKind.True => BsonBoolean.True,
            JsonValueKind.False => BsonBoolean.False,
            _ => BsonNull.Value
        };


    public void Fault(Exception ex)
    {
        _activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
        _record.Status = "Error";

        var data = new Dictionary<string, string?>();
        foreach (System.Collections.DictionaryEntry entry in ex.Data)
            data[entry.Key?.ToString() ?? string.Empty] = entry.Value?.ToString();

        _record.Exceptions.Add(new ExceptionInfo
        {
            Type = ex.GetType().FullName ?? ex.GetType().Name,
            Message = ex.Message,
            StackTrace = ex.StackTrace,
            Data = data
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
