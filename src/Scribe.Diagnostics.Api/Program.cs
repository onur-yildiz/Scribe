using Scribe.Diagnostics;
using Scribe.Diagnostics.Queries;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddScribeDiagnostics(options =>
{
    options.ConnectionString = builder.Configuration.GetValue<string>("Scribe:ConnectionString")
        ?? "mongodb://localhost:27017";
    options.DatabaseName = builder.Configuration.GetValue<string>("Scribe:DatabaseName")
        ?? "ScribeDiagnostics";
});

builder.Services.AddScribeActivityReadSide();

var app = builder.Build();

app.MapGet("/api/activities/{traceId}", async (
    string traceId,
    IActivityQueryService queryService,
    CancellationToken ct) =>
{
    var result = await queryService.GetTraceAsync(traceId, ct).ConfigureAwait(false);
    return result is null ? Results.NotFound() : Results.Ok(result);
})
.WithName("GetTraceById")
;

app.MapPost("/api/activities/search", async (
    ActivitySearchRequest request,
    IActivityQueryService queryService,
    CancellationToken ct) =>
{
    var result = await queryService.SearchActivitiesAsync(request, ct).ConfigureAwait(false);
    return Results.Ok(result);
})
.WithName("SearchActivities")
;

app.Run();
