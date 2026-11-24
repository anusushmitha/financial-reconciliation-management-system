using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

public class OutboxWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<OutboxWorker> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly string _aiServiceUrl;

    public OutboxWorker(
        IServiceProvider serviceProvider, 
        ILogger<OutboxWorker> logger, 
        IHttpClientFactory httpClientFactory,
        IConfiguration config)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _httpClientFactory = httpClientFactory;
        _aiServiceUrl = config["AIService__BaseUrl"] ?? "http://ai:8000";
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("LendGuard Outbox Worker started. Monitoring OutboxMessages table...");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<LendGuardContext>();

                var pendingMessages = await db.OutboxMessages
                    .Where(m => m.Status == "Pending" && m.RetryCount < 5)
                    .OrderBy(m => m.CreatedAt)
                    .Take(10)
                    .ToListAsync(stoppingToken);

                if (pendingMessages.Any())
                {
                    _logger.LogInformation("Processing {Count} pending outbox messages...", pendingMessages.Count);

                    foreach (var msg in pendingMessages)
                    {
                        try
                        {
                            msg.Status = "Processing";
                            await db.SaveChangesAsync(stoppingToken);

                            if (msg.EventType == "ExceptionCreated")
                            {
                                await ProcessExceptionCreatedAsync(db, msg, stoppingToken);
                            }

                            msg.Status = "Processed";
                            msg.ProcessedAt = DateTime.UtcNow;
                            _logger.LogInformation("Successfully processed outbox message {Id} ({EventType})", msg.Id, msg.EventType);
                        }
                        catch (Exception ex)
                        {
                            msg.RetryCount++;
                            msg.Status = msg.RetryCount >= 5 ? "Failed" : "Pending";
                            msg.ErrorMessage = ex.Message;
                            _logger.LogWarning("Failed processing outbox message {Id}: {Error}. Retry count: {Retries}", msg.Id, ex.Message, msg.RetryCount);
                        }

                        await db.SaveChangesAsync(stoppingToken);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred in outbox polling loop.");
            }

            // Poll interval: 5 seconds
            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
        }
    }

    private async Task ProcessExceptionCreatedAsync(LendGuardContext db, OutboxMessage msg, CancellationToken ct)
    {
        using var doc = JsonDocument.Parse(msg.Payload);
        string? refId = doc.RootElement.GetProperty("ExceptionReference").GetString();

        if (string.IsNullOrEmpty(refId)) return;

        // Find the exception record
        var exceptionRecord = await db.Exceptions.FirstOrDefaultAsync(e => e.TransactionReference == refId, ct);
        if (exceptionRecord != null && exceptionRecord.AiAnomalyScore == null)
        {
            try
            {
                var client = _httpClientFactory.CreateClient();
                var payload = new
                {
                    transaction_reference = refId,
                    exception_type = exceptionRecord.ExceptionType,
                    amount = (double)exceptionRecord.Amount,
                    severity = exceptionRecord.Severity,
                    description = exceptionRecord.Description,
                    evidence_text = exceptionRecord.Evidence
                };

                var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
                var res = await client.PostAsync($"{_aiServiceUrl}/analyze", content, ct);

                if (res.IsSuccessStatusCode)
                {
                    var resJson = await res.Content.ReadAsStringAsync(ct);
                    using var resDoc = JsonDocument.Parse(resJson);
                    var root = resDoc.RootElement;

                    exceptionRecord.AiAnomalyScore = root.GetProperty("anomaly_score").GetDouble();
                    exceptionRecord.AiClassification = root.GetProperty("classification").GetString();
                    exceptionRecord.AiExplanation = root.GetProperty("explanation").GetString();
                    exceptionRecord.AiRecommendedSteps = root.GetProperty("recommended_steps").ToString();
                    exceptionRecord.LastUpdatedDate = DateTime.UtcNow;

                    _logger.LogInformation("Auto-enriched exception #{Id} for ref '{Ref}' with AI score {Score}", exceptionRecord.Id, refId, exceptionRecord.AiAnomalyScore);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning("AI auto-enrichment call timed out or failed: {Msg}", ex.Message);
            }
        }
    }
}

public class Program
{
    public static void Main(string[] args)
    {
        var host = Host.CreateDefaultBuilder(args)
            .ConfigureServices((context, services) =>
            {
                services.AddDbContext<LendGuardContext>(options =>
                    options.UseNpgsql(context.Configuration.GetConnectionString("DefaultConnection")));
                
                services.AddHttpClient();
                services.AddHostedService<OutboxWorker>();
            })
            .Build();

        host.Run();
    }
}
