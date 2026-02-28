using Scribe.Diagnostics;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddScribeDiagnostics(options =>
{
    options.ConnectionString = builder.Configuration.GetValue<string>("Scribe:ConnectionString")
        ?? "mongodb://localhost:27017";
    options.DatabaseName = builder.Configuration.GetValue<string>("Scribe:DatabaseName")
        ?? "ScribeDiagnostics";
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapGet("/weatherforecast", (ScribeFactory scribe) =>
{
    using var entry = scribe.Start("GetWeatherForecast");
    try
    {
        var forecast = Enumerable.Range(1, 5).Select(index =>
            new WeatherForecast
            (
                DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
                Random.Shared.Next(-20, 55),
                summaries[Random.Shared.Next(summaries.Length)]
            ))
            .ToArray();

        entry.Note("result.count", forecast.Length.ToString());
        entry.AttachDump("forecast", forecast);

        return forecast;
    }
    catch (Exception ex)
    {
        entry.Fault(ex);
        throw;
    }
})
.WithName("GetWeatherForecast")
.WithOpenApi();

app.Run();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
