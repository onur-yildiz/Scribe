namespace Scribe.Diagnostics;

public sealed class ScribeFactory
{
    private readonly ScribeChannel _channel;
    private readonly IEnumerable<IScribeRedactor> _redactors;

    public ScribeFactory(ScribeChannel channel, IEnumerable<IScribeRedactor> redactors)
    {
        _channel = channel;
        _redactors = redactors;
    }

    public IScribeEntry Start(string operationName) =>
        new ScribeEntry(operationName, _channel, _redactors);
}
