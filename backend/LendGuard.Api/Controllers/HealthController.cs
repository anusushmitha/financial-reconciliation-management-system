using System;
using System.Diagnostics;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using LendGuard.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;

namespace LendGuard.Api.Controllers;

[ApiController]
[AllowAnonymous]
public class HealthController : ControllerBase
{
    private readonly LendGuardDbContext _context;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;

    public HealthController(
        LendGuardDbContext context,
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration)
    {
        _context = context;
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
    }

    [HttpGet("health")]
    [HttpGet("api/v1/health")]
    public IActionResult GetHealth()
    {
        return Ok(new { status = "Healthy" });
    }

    [HttpGet("health/ready")]
    [HttpGet("api/v1/health/ready")]
    public async Task<IActionResult> GetReadiness(CancellationToken cancellationToken)
    {
        var totalSw = Stopwatch.StartNew();
        bool dbConnected = false;
        try
        {
            dbConnected = await _context.Database.CanConnectAsync(cancellationToken);
        }
        catch
        {
            dbConnected = false;
        }

        bool aiOnline = false;
        long aiLatencyMs = -1;
        var aiBaseUrl = (_configuration["AI_SERVICE_BASE_URL"] ?? "http://localhost:8000").TrimEnd('/');
        var aiKey = _configuration["AI_SERVICE_KEY"] ?? "lendguard_internal_ai_secret_key_2026";

        try
        {
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(2);
            using var req = new HttpRequestMessage(HttpMethod.Get, $"{aiBaseUrl}/internal/v1/health");
            req.Headers.Add("X-Service-Key", aiKey);
            var aiSw = Stopwatch.StartNew();
            using var res = await client.SendAsync(req, cancellationToken);
            aiSw.Stop();
            aiLatencyMs = aiSw.ElapsedMilliseconds;
            aiOnline = res.IsSuccessStatusCode;
        }
        catch
        {
            aiOnline = false;
        }

        totalSw.Stop();
        var overall = dbConnected ? (aiOnline ? "Healthy" : "Degraded") : "Unhealthy";

        var payload = new
        {
            status = overall,
            database = dbConnected ? "Connected" : "Disconnected",
            aiService = aiOnline ? "Online" : "Offline",
            aiLatencyMs = aiOnline ? aiLatencyMs : (long?)null,
            apiLatencyMs = totalSw.ElapsedMilliseconds,
            timestamp = DateTimeOffset.UtcNow
        };

        return dbConnected ? Ok(payload) : StatusCode(503, payload);
    }
}
