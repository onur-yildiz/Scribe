using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;

namespace Scribe.Diagnostics;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddScribeDiagnostics(
        this IServiceCollection services,
        Action<ScribeOptions> configure)
    {
        var options = new ScribeOptions();
        configure(options);

        services.AddSingleton(options);
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
