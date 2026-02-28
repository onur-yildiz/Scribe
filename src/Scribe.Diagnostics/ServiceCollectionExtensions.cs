using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;

namespace Scribe.Diagnostics;

public sealed class ScribeDiagnosticsOptions
{
    public string ConnectionString { get; set; } = "mongodb://localhost:27017";
    public string DatabaseName { get; set; } = "ScribeDiagnostics";
}

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddScribeDiagnostics(
        this IServiceCollection services,
        Action<ScribeDiagnosticsOptions> configure)
    {
        var options = new ScribeDiagnosticsOptions();
        configure(options);

        services.AddSingleton<ScribeChannel>();
        services.AddSingleton<ScribeFactory>();

        services.AddSingleton<IMongoClient>(_ =>
            new MongoClient(options.ConnectionString));

        services.AddSingleton<IMongoDatabase>(sp =>
            sp.GetRequiredService<IMongoClient>().GetDatabase(options.DatabaseName));

        services.AddHostedService<ScribeMongoWorker>();

        return services;
    }
}
