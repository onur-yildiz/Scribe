using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;
using Scribe.Diagnostics.Models;
using Scribe.Diagnostics.Queries;

namespace Scribe.Diagnostics;

/// <summary>
/// Dependency injection extensions for Scribe diagnostics.
/// </summary>
public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Registers core Scribe diagnostics services.
    /// </summary>
    /// <param name="services">Service collection.</param>
    /// <param name="configure">Options configuration delegate.</param>
    /// <returns>The service collection.</returns>
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

    /// <summary>
    /// Registers read-side query services and startup index creation.
    /// </summary>
    public static IServiceCollection AddScribeActivityReadSide(this IServiceCollection services)
    {
        services.AddSingleton(sp =>
            sp.GetRequiredService<IMongoDatabase>().GetCollection<MongoActivityRecord>(MongoCollectionNames.ScribeActivities));

        services.AddSingleton<IActivityQueryService, ActivityQueryService>();
        services.AddHostedService<ScribeActivityIndexInitializer>();

        return services;
    }

    /// <summary>
    /// Registers the default key-based redactor.
    /// </summary>
    /// <param name="services">Service collection.</param>
    /// <param name="configure">Optional redactor options configuration.</param>
    /// <returns>The service collection.</returns>
    public static IServiceCollection AddDefaultSensiviteKeyRedactor(
        this IServiceCollection services,
        Action<DefaultSensitiveKeyRedactorOptions>? configure = null)
    {
        var options = new DefaultSensitiveKeyRedactorOptions();
        configure?.Invoke(options);

        services.AddSingleton<IScribeRedactor>(_ => new DefaultSensitiveKeyRedactor(options));

        return services;
    }
}
