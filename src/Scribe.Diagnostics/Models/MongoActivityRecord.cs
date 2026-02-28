using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Scribe.Diagnostics.Models;

/// <summary>
/// MongoDB document representing a traced operation.
/// </summary>
public sealed class MongoActivityRecord
{
    /// <summary>
    /// Gets or sets the MongoDB document identifier.
    /// </summary>
    [BsonId]
    public ObjectId Id { get; set; } = ObjectId.GenerateNewId();

    /// <summary>
    /// Gets or sets the trace identifier.
    /// </summary>
    public string TraceId { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the span identifier.
    /// </summary>
    public string SpanId { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the parent span identifier.
    /// </summary>
    public string? ParentSpanId { get; set; }

    /// <summary>
    /// Gets or sets the operation name.
    /// </summary>
    public string OperationName { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the UTC start time.
    /// </summary>
    public DateTime StartTimeUtc { get; set; }

    /// <summary>
    /// Gets or sets the operation duration.
    /// </summary>
    public TimeSpan Duration { get; set; }

    /// <summary>
    /// Gets or sets the operation status.
    /// </summary>
    public string Status { get; set; } = "Ok";

    /// <summary>
    /// Gets or sets activity tags.
    /// </summary>
    public Dictionary<string, string> Tags { get; set; } = new();

    /// <summary>
    /// Gets or sets baggage values.
    /// </summary>
    public Dictionary<string, string> Baggage { get; set; } = new();

    /// <summary>
    /// Gets or sets attached payload dumps.
    /// </summary>
    public Dictionary<string, BsonValue> Dump { get; set; } = new();

    /// <summary>
    /// Gets or sets captured exceptions.
    /// </summary>
    public List<ExceptionInfo> Exceptions { get; set; } = new();

    /// <summary>
    /// Gets or sets activity events.
    /// </summary>
    public List<ScribeEventRecord> Events { get; set; } = new();
}

/// <summary>
/// Represents serialized exception information.
/// </summary>
public sealed class ExceptionInfo
{
    /// <summary>
    /// Gets or sets the exception type name.
    /// </summary>
    public string Type { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the exception message.
    /// </summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the exception stack trace.
    /// </summary>
    public string? StackTrace { get; set; }

    /// <summary>
    /// Gets or sets exception data payload.
    /// </summary>
    public Dictionary<string, object?> Data { get; set; } = new();
}
