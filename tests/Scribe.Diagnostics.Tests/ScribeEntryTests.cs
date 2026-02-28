using System.Diagnostics;
using MongoDB.Bson;
using Scribe.Diagnostics;
using Scribe.Diagnostics.Models;

namespace Scribe.Diagnostics.Tests;

public sealed class ScribeEntryTests
{
    [Fact]
    public void Dispose_EnqueuesRecord_WithTagsBaggageDumpAndEvents()
    {
        using var listener = CreateListener();
        var channel = new ScribeChannel(new ScribeOptions { MaxQueueCapacity = 100 });
        var redactor = new DefaultSensitiveKeyRedactor(new DefaultSensitiveKeyRedactorOptions());

        using (var entry = new ScribeEntry("test.operation", channel, [redactor]))
        {
            entry.Note("username", "alice");
            entry.Note("token", "secret-token");
            entry.AddBaggage("tenant", "alpha");
            entry.AddEvent("created", new Dictionary<string, object> { ["kind"] = "demo" });
            entry.AttachDump("payload", new { Count = 2, Name = "record" });
        }

        Assert.True(channel.Reader.TryRead(out MongoActivityRecord? record));
        Assert.NotNull(record);
        Assert.Equal("test.operation", record.OperationName);
        Assert.Equal("alice", record.Tags["username"]);
        Assert.Equal("[*** REDACTED ***]", record.Tags["token"]);
        Assert.Equal("alpha", record.Baggage["tenant"]);
        Assert.Single(record.Events);
        Assert.Equal("created", record.Events[0].Name);
        Assert.Equal("demo", record.Events[0].Tags["kind"]);

        var dump = Assert.IsType<BsonDocument>(record.Dump["payload"]);
        Assert.Equal(2, dump["Count"].AsInt32);
        Assert.Equal("record", dump["Name"].AsString);
    }

    [Fact]
    public void Fault_StoresExceptionAndRedactsExceptionData()
    {
        using var listener = CreateListener();
        var channel = new ScribeChannel(new ScribeOptions());
        var redactor = new DefaultSensitiveKeyRedactor(new DefaultSensitiveKeyRedactorOptions());

        using (var entry = new ScribeEntry("failing.operation", channel, [redactor]))
        {
            var ex = new InvalidOperationException("boom");
            ex.Data["password"] = "super-secret";

            entry.Fault(ex);
        }

        Assert.True(channel.Reader.TryRead(out var record));
        Assert.Equal("Error", record!.Status);
        Assert.Single(record.Exceptions);

        var info = record.Exceptions[0];
        Assert.Equal(typeof(InvalidOperationException).FullName, info.Type);
        var data = Assert.IsType<BsonString>(info.Data["password"]);
        Assert.Equal("[*** REDACTED ***]", data.AsString);
    }

    private static ActivityListener CreateListener()
    {
        var listener = new ActivityListener
        {
            ShouldListenTo = source => source.Name == "Scribe.Diagnostics",
            Sample = static (ref ActivityCreationOptions<ActivityContext> _) => ActivitySamplingResult.AllDataAndRecorded,
            SampleUsingParentId = static (ref ActivityCreationOptions<string> _) => ActivitySamplingResult.AllDataAndRecorded
        };

        ActivitySource.AddActivityListener(listener);
        return listener;
    }
}
