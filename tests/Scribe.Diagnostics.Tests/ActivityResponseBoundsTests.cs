using Scribe.Diagnostics.Queries;

namespace Scribe.Diagnostics.Tests;

public sealed class ActivityResponseBoundsTests
{
    [Fact]
    public void Truncate_ReturnsOriginal_WhenWithinLimit()
    {
        var value = "abc";

        var result = ActivityResponseBounds.Truncate(value, 5);

        Assert.Equal(value, result);
    }

    [Fact]
    public void Truncate_AddsEllipsis_WhenOverLimit()
    {
        var result = ActivityResponseBounds.Truncate("abcdef", 4);

        Assert.Equal("abc…", result);
    }
}
