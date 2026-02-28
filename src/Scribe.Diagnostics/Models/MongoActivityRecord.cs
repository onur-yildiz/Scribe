using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Scribe.Diagnostics.Models;

public sealed class MongoActivityRecord
{
    [BsonId]
    public ObjectId Id { get; set; } = ObjectId.GenerateNewId();

    public string TraceId { get; set; } = string.Empty;
    public string SpanId { get; set; } = string.Empty;
    public string? ParentSpanId { get; set; }
    public string OperationName { get; set; } = string.Empty;
    public DateTime StartTimeUtc { get; set; }
    public TimeSpan Duration { get; set; }
    public string Status { get; set; } = "Ok";

    public Dictionary<string, string> Tags { get; set; } = new();
    public Dictionary<string, string> Baggage { get; set; } = new();
    public Dictionary<string, BsonValue> Dump { get; set; } = new();
    public List<ExceptionInfo> Exceptions { get; set; } = new();
    public List<ScribeEventRecord> Events { get; set; } = new();
}

public sealed class ExceptionInfo
{
    public string Type { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? StackTrace { get; set; }
    public Dictionary<string, object?> Data { get; set; } = new();
}
