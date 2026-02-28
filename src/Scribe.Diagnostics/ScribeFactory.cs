namespace Scribe.Diagnostics;

/// <summary>
/// Factory used to start operation-scoped diagnostics entries.
/// </summary>
public sealed class ScribeFactory
{
    private readonly ScribeChannel _channel;
    private readonly IEnumerable<IScribeRedactor> _redactors;

    /// <summary>
    /// Initializes a new <see cref="ScribeFactory"/> instance.
    /// </summary>
    /// <param name="channel">Record channel.</param>
    /// <param name="redactors">Redactors to run over values.</param>
    public ScribeFactory(ScribeChannel channel, IEnumerable<IScribeRedactor> redactors)
    {
        _channel = channel;
        _redactors = redactors;
    }

    /// <summary>
    /// Starts a new diagnostics entry for the provided operation name.
    /// </summary>
    /// <param name="operationName">Operation name.</param>
    /// <returns>A disposable diagnostics entry.</returns>
    public IScribeEntry Start(string operationName) =>
        new ScribeEntry(operationName, _channel, _redactors);
}
