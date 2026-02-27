using System.Threading.Channels;
using Scribe.Diagnostics.Models;

namespace Scribe.Diagnostics;

public sealed class ScribeChannel
{
    private readonly Channel<MongoActivityRecord> _channel =
        Channel.CreateUnbounded<MongoActivityRecord>(new UnboundedChannelOptions
        {
            SingleReader = true,
            AllowSynchronousContinuations = false
        });

    public ChannelReader<MongoActivityRecord> Reader => _channel.Reader;

    public void Enqueue(MongoActivityRecord record) =>
        _channel.Writer.TryWrite(record);

    internal void Complete() => _channel.Writer.TryComplete();
}
