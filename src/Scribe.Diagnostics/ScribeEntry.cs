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
    private readonly IScribeRedactor[] _redactors;
    private bool _disposed;

    public ScribeEntry(string operationName, ScribeChannel channel, IEnumerable<IScribeRedactor> redactors)
    {
        _channel = channel;
        _redactors = redactors as IScribeRedactor[] ?? redactors.ToArray();
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
        var redactedValue = RedactValue(key, value);
        var valueString = redactedValue?.ToString() ?? string.Empty;

        _activity?.SetTag(key, valueString);
    }

    public void AddBaggage(string key, string value)
    {
        _activity?.AddBaggage(key, value);
    }

    public void AddEvent(string name, Dictionary<string, object>? tags = null)
    {
        ActivityTagsCollection? tagsCollection = null;

        if (tags is { Count: > 0 })
        {
            tagsCollection = new ActivityTagsCollection();
            foreach (var tag in tags)
                tagsCollection.Add(tag.Key, tag.Value);
        }

        var activityEvent = new ActivityEvent(name, DateTimeOffset.UtcNow, tagsCollection);
        _activity?.AddEvent(activityEvent);
    }

    public void AttachDump(string key, object? payload)
    {
        var redactedValue = RedactValue(key, payload);
        _record.Dump[key] = ToBsonValue(redactedValue);
    }

    private object? RedactValue(string key, object? value)
    {
        var redacted = value;

        foreach (var redactor in _redactors)
            redacted = redactor.Redact(key, redacted);

        return redacted;
    }

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

        var data = new Dictionary<string, object?>();
        foreach (System.Collections.DictionaryEntry entry in ex.Data)
        {
            var key = entry.Key?.ToString() ?? string.Empty;
            var redactedValue = RedactValue(key, entry.Value);
            data[key] = ToBsonValue(redactedValue);
        }

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

        if (_activity is not null)
        {
            foreach (var tag in _activity.Tags)
                _record.Tags[tag.Key] = tag.Value ?? string.Empty;

            foreach (var baggage in _activity.Baggage)
                _record.Baggage[baggage.Key] = baggage.Value ?? string.Empty;

            if (_activity.Events.Any())
            {
                foreach (var activityEvent in _activity.Events)
                {
                    var eventRecord = new ScribeEventRecord
                    {
                        Name = activityEvent.Name,
                        Timestamp = activityEvent.Timestamp
                    };

                    foreach (var tag in activityEvent.Tags)
                        eventRecord.Tags[tag.Key] = tag.Value ?? string.Empty;

                    _record.Events.Add(eventRecord);
                }
            }
        }

        _record.Duration = DateTime.UtcNow - _record.StartTimeUtc;
        _activity?.Stop();
        _activity?.Dispose();

        _channel.Enqueue(_record);
    }
}
