# Scribe.Diagnostics

Scribe.Diagnostics is a small .NET diagnostics package that helps you:

- Create operation-scoped diagnostics entries.
- Attach notes, baggage, events, and structured payload dumps.
- Redact sensitive data before storage.
- Persist operation records asynchronously to MongoDB.

## Installation

```bash
dotnet add package Scribe.Diagnostics
```

## Quick start

Register Scribe in your service container:

```csharp
using Scribe.Diagnostics;

builder.Services
    .AddScribeDiagnostics(options =>
    {
        options.ConnectionString = "mongodb://localhost:27017";
        options.DatabaseName = "ScribeDiagnostics";
        options.MaxQueueCapacity = 10_000;
    })
    .AddDefaultSensiviteKeyRedactor();
```

Use `ScribeFactory` in your code:

```csharp
public sealed class PaymentService
{
    private readonly ScribeFactory _scribeFactory;

    public PaymentService(ScribeFactory scribeFactory)
    {
        _scribeFactory = scribeFactory;
    }

    public void Charge(string userId, string cardToken)
    {
        using var entry = _scribeFactory.Start("payment.charge");

        entry.Note("user.id", userId);
        entry.Note("token", cardToken); // gets redacted by the default redactor
        entry.AddEvent("payment.requested", new Dictionary<string, object>
        {
            ["provider"] = "stripe"
        });

        try
        {
            // business logic...
        }
        catch (Exception ex)
        {
            entry.Fault(ex);
            throw;
        }
    }
}
```

## API docs in IDE / NuGet consumers

This package is configured to generate XML documentation files during build and include them in NuGet packages. That enables IntelliSense summaries when consumers install the package.

## Configuration

### `ScribeOptions`

- `ConnectionString`: MongoDB connection string.
- `DatabaseName`: Target database name.
- `MaxQueueCapacity`: Maximum in-memory record buffer before dropping writes.

### Sensitive data redaction

You can customize the default key list:

```csharp
builder.Services.AddDefaultSensiviteKeyRedactor(options =>
{
    options.AddSensitiveKey("credit_card");
    options.RemoveSensitiveKey("public_key");
});
```

## Dashboard UI (Next.js + shadcn)

A new dashboard app is available at `src/scribe-diagnostics-dashboard` for mobile-friendly trace exploration and payload inspection.

Run it locally:

```bash
cd src/scribe-diagnostics-dashboard
npm install
npm run dev
```

## Package development

Build and test:

```bash
dotnet build
dotnet test
```

Create package:

```bash
dotnet pack src/Scribe.Diagnostics/Scribe.Diagnostics.csproj -c Release
```

## License

Add your preferred license (for example MIT) before publishing to NuGet.
