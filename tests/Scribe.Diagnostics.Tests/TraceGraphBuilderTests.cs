using Scribe.Diagnostics.Models;
using Scribe.Diagnostics.Read;

namespace Scribe.Diagnostics.Tests;

public sealed class TraceGraphBuilderTests
{
    [Fact]
    public void Build_ComputesSummaryAndDeterministicSort_WithMultipleRoots()
    {
        var start = new DateTime(2025, 1, 10, 12, 0, 0, DateTimeKind.Utc);

        var records = new[]
        {
            CreateRecord("trace-1", "b-root", null, "root B", start.AddMilliseconds(50), 120, status: "Ok"),
            CreateRecord("trace-1", "a-root", null, "root A", start, 150, status: "Ok"),
            CreateRecord("trace-1", "child-1", "a-root", "child", start.AddMilliseconds(30), 30, status: "Warn")
        };

        var view = TraceGraphBuilder.Build(records);

        Assert.Equal("a-root", view.Summary.RootSpanId);
        Assert.Equal(2, view.Summary.RootCount);
        Assert.Equal(170, view.Summary.TotalDurationMs);

        Assert.Collection(
            view.Spans,
            span => Assert.Equal("a-root", span.Id),
            span => Assert.Equal("child-1", span.Id),
            span => Assert.Equal("b-root", span.Id));
    }

    [Fact]
    public void Build_MarksMissingParentAsRootAndSetsDepthToZero()
    {
        var start = DateTime.UtcNow;
        var record = CreateRecord("trace-2", "orphan", "missing", "orphan op", start, 50, exceptions: [new ExceptionInfo()]);

        var view = TraceGraphBuilder.Build([record]);

        Assert.Equal("orphan", view.Summary.RootSpanId);
        var node = Assert.Single(view.Spans);
        Assert.Equal(0, node.Depth);
        Assert.True(node.Status.IsError);
        Assert.Equal(SpanStatusSeverity.Error, node.Status.Severity);
    }

    [Fact]
    public void Build_AllowsNegativeOffsets_WhenChildStartsBeforeRoot()
    {
        var rootStart = new DateTime(2025, 1, 10, 8, 0, 0, DateTimeKind.Utc);

        var records = new[]
        {
            CreateRecord("trace-3", "root", null, "root", rootStart, 50),
            CreateRecord("trace-3", "child", "root", "child", rootStart.AddMilliseconds(-15), 10)
        };

        var view = TraceGraphBuilder.Build(records);

        var child = Assert.Single(view.Spans, s => s.Id == "child");
        Assert.Equal(-15, child.StartOffsetMs);
    }

    [Fact]
    public void Build_ComputesDepthForDeeplyNestedSpans()
    {
        var start = new DateTime(2025, 1, 10, 15, 0, 0, DateTimeKind.Utc);
        var records = new List<MongoActivityRecord>();

        string? parent = null;
        for (var i = 0; i < 8; i++)
        {
            var id = $"span-{i}";
            records.Add(CreateRecord("trace-4", id, parent, $"op-{i}", start.AddMilliseconds(i * 5), 5));
            parent = id;
        }

        var view = TraceGraphBuilder.Build(records);

        for (var i = 0; i < 8; i++)
        {
            var node = Assert.Single(view.Spans, s => s.Id == $"span-{i}");
            Assert.Equal(i, node.Depth);
        }
    }

    private static MongoActivityRecord CreateRecord(
        string traceId,
        string spanId,
        string? parentSpanId,
        string operation,
        DateTime start,
        double durationMs,
        string status = "Ok",
        List<ExceptionInfo>? exceptions = null)
    {
        return new MongoActivityRecord
        {
            TraceId = traceId,
            SpanId = spanId,
            ParentSpanId = parentSpanId,
            OperationName = operation,
            StartTimeUtc = start,
            Duration = TimeSpan.FromMilliseconds(durationMs),
            Status = status,
            Tags = new Dictionary<string, string>
            {
                ["service.name"] = "svc",
                ["http.method"] = "GET"
            },
            Baggage = new Dictionary<string, string>
            {
                ["tenant"] = "alpha"
            },
            Exceptions = exceptions ?? []
        };
    }
}
