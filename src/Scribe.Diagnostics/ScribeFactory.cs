namespace Scribe.Diagnostics;

public sealed class ScribeFactory
{
    private readonly ScribeChannel _channel;

    public ScribeFactory(ScribeChannel channel) => _channel = channel;

    public IScribeEntry Start(string operationName) =>
        new ScribeEntry(operationName, _channel);
}
