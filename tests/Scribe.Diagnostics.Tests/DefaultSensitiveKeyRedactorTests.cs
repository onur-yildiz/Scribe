using Scribe.Diagnostics;

namespace Scribe.Diagnostics.Tests;

public sealed class DefaultSensitiveKeyRedactorTests
{
    [Fact]
    public void Redact_RedactsConfiguredKey_IgnoringCaseAndPunctuation()
    {
        var options = new DefaultSensitiveKeyRedactorOptions();
        var sut = new DefaultSensitiveKeyRedactor(options);

        var redacted = sut.Redact("Access-Token", "secret-value");

        Assert.Equal("[*** REDACTED ***]", redacted);
    }

    [Fact]
    public void Redact_ReturnsOriginalValue_ForNonSensitiveKey()
    {
        var options = new DefaultSensitiveKeyRedactorOptions();
        var sut = new DefaultSensitiveKeyRedactor(options);

        var value = sut.Redact("username", "alice");

        Assert.Equal("alice", value);
    }

    [Fact]
    public void Options_CanAddAndRemoveSensitiveKeys()
    {
        var options = new DefaultSensitiveKeyRedactorOptions()
            .AddSensitiveKey("credit_card")
            .RemoveSensitiveKey("password");

        Assert.Contains("credit_card", options.SensitiveKeys);
        Assert.DoesNotContain("password", options.SensitiveKeys);
    }
}
