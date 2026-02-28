using System.Threading.Channels;
using Scribe.Diagnostics.Models;

namespace Scribe.Diagnostics;

public sealed class ScribeChannel
{
    private readonly Channel<MongoActivityRecord> _channel;

    public ScribeChannel(ScribeOptions options)
    {
        var capacity = options.MaxQueueCapacity > 0 ? options.MaxQueueCapacity : 10_000;

        _channel = Channel.CreateBounded<MongoActivityRecord>(new BoundedChannelOptions(capacity)
        {
            SingleReader = true,
            SingleWriter = false,
            AllowSynchronousContinuations = false,
            FullMode = BoundedChannelFullMode.DropWrite
        });
    }

    public ChannelReader<MongoActivityRecord> Reader => _channel.Reader;

    public void Enqueue(MongoActivityRecord record) =>
        _channel.Writer.TryWrite(record);

    internal void Complete() => _channel.Writer.TryComplete();
}
