using System.Threading.Channels;
using Scribe.Diagnostics.Models;

namespace Scribe.Diagnostics;

/// <summary>
/// Buffered channel used to enqueue activity records for background persistence.
/// </summary>
public sealed class ScribeChannel
{
    private readonly Channel<MongoActivityRecord> _channel;

    /// <summary>
    /// Initializes a new channel using configured capacity.
    /// </summary>
    /// <param name="options">Scribe options.</param>
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

    /// <summary>
    /// Gets the channel reader.
    /// </summary>
    public ChannelReader<MongoActivityRecord> Reader => _channel.Reader;

    /// <summary>
    /// Enqueues a record for processing.
    /// </summary>
    /// <param name="record">Record to enqueue.</param>
    public void Enqueue(MongoActivityRecord record) =>
        _channel.Writer.TryWrite(record);

    /// <summary>
    /// Completes the channel writer.
    /// </summary>
    public void Complete() => _channel.Writer.Complete();
}
