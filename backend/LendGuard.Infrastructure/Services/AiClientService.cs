using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using LendGuard.Application.Common.Interfaces;
using LendGuard.Application.DTOs;
using LendGuard.Domain;
using LendGuard.Domain.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace LendGuard.Infrastructure.Services;

public class AiClientService : IAiClientService
{
    private readonly HttpClient _httpClient;
    private readonly string _serviceKey;
    private readonly ILogger<AiClientService> _logger;

    public AiClientService(HttpClient httpClient, IConfiguration configuration, ILogger<AiClientService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
        _serviceKey = configuration["AI_SERVICE_KEY"] ?? "lendguard_internal_ai_secret_key_2026";

        var baseUrl = configuration["AI_SERVICE_BASE_URL"] ?? "http://localhost:8000";
        _httpClient.BaseAddress = new Uri(baseUrl);
        _httpClient.Timeout = TimeSpan.FromSeconds(10);
    }

    public async Task<AiAnalysisDto> AnalyzeAnomalyAsync(DiscrepancyException exception, Transaction? evidenceTxn, CancellationToken cancellationToken = default)
    {
        var analysisId = Guid.NewGuid();
        var internalTxn = exception.InternalTransaction;
        var externalTxn = exception.ExternalTransaction;
        var effectiveTxn = evidenceTxn ?? internalTxn ?? externalTxn;

        var amountVal = effectiveTxn?.Amount ?? exception.ExpectedAmount ?? exception.ActualAmount ?? exception.DiscrepancyAmount ?? 0m;
        var dateVal = effectiveTxn?.TransactionDate ?? exception.CreatedAt;

        var dateDiffDays = (internalTxn != null && externalTxn != null)
            ? (int)Math.Abs((internalTxn.TransactionDate - externalTxn.TransactionDate).TotalDays)
            : 0;

        string? unmatchedSide = null;
        if (internalTxn == null && externalTxn != null) unmatchedSide = "INTERNAL";
        else if (externalTxn == null && internalTxn != null) unmatchedSide = "EXTERNAL";

        var payload = new
        {
            analysisId = analysisId.ToString(),
            exceptionId = exception.Id.ToString(),
            transactionEvidence = new
            {
                amount = amountVal.ToString("F2"),
                currency = effectiveTxn?.Currency ?? "INR",
                transactionDate = dateVal.ToString("O"),
                transactionType = effectiveTxn?.TransactionType ?? "REPAYMENT"
            },
            featureContext = new
            {
                amountDeviation = (exception.DiscrepancyAmount ?? 0m).ToString("F2"),
                expectedAmount = (exception.ExpectedAmount ?? 0m).ToString("F2"),
                actualAmount = (exception.ActualAmount ?? 0m).ToString("F2"),
                dateDifferenceDays = dateDiffDays,
                exceptionType = exception.ExceptionType,
                unmatchedSide = unmatchedSide
            }
        };

        try
        {
            var request = new HttpRequestMessage(HttpMethod.Post, "/internal/v1/anomaly-detection")
            {
                Content = JsonContent.Create(payload)
            };
            request.Headers.Add("X-Service-Key", _serviceKey);

            var response = await _httpClient.SendAsync(request, cancellationToken);
            if (response.IsSuccessStatusCode)
            {
                var result = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: cancellationToken);
                var score = result.GetProperty("anomalyScore").GetDouble();
                var riskLevel = result.TryGetProperty("riskLevel", out var rl) ? rl.GetString() : (score >= 0.8 ? "CRITICAL" : (score >= 0.6 ? "HIGH" : (score >= 0.35 ? "MODERATE" : "LOW")));
                var modelVersion = result.TryGetProperty("modelVersion", out var mv) ? mv.GetString() : "scikit-learn/isolation-forest-v1.2";

                return new AiAnalysisDto
                {
                    AnalysisId = analysisId,
                    Status = AiAnalysisStatus.Completed,
                    AnalysisType = AiAnalysisType.Anomaly,
                    Summary = $"Anomaly Risk Score: {score:P0} ({riskLevel} Risk). IsolationForest evaluated multi-dimensional transaction features.",
                    Evidence = result,
                    Recommendation = score >= 0.70
                        ? "High anomaly risk: Prioritize immediate manual ledger reconciliation and settlement voucher inspection."
                        : "Moderate-to-low risk: Standard operational workflow verification is sufficient.",
                    AdvisoryOnly = true,
                    ModelName = modelVersion,
                    CreatedAt = DateTimeOffset.UtcNow
                };
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to call AI microservice anomaly detection, falling back to heuristic advisory.");
        }

        // Resilient fallback when AI service is unavailable
        var fallbackCurrency = effectiveTxn?.Currency ?? "INR";
        var fallbackScore = (exception.DiscrepancyAmount > 5000) ? 0.85 : 0.35;
        var fallbackRisk = fallbackScore >= 0.8 ? "CRITICAL" : "MODERATE";
        return new AiAnalysisDto
        {
            AnalysisId = analysisId,
            Status = AiAnalysisStatus.Completed,
            AnalysisType = AiAnalysisType.Anomaly,
            Summary = $"Heuristic anomaly score: {fallbackScore:P0} ({fallbackRisk} Risk) based on discrepancy magnitude of {fallbackCurrency} {exception.DiscrepancyAmount:N2}.",
            Evidence = new
            {
                anomalyScore = fallbackScore,
                riskLevel = fallbackRisk,
                signals = (exception.DiscrepancyAmount > 5000) ? new[] { "CRITICAL_AMOUNT_DEVIATION" } : new[] { "MINOR_VARIANCE_TOLERANCE" },
                algorithm = "Deterministic Heuristic Calibration",
                modelVersion = "heuristic-fallback-v1"
            },
            Recommendation = "Verify settlement advice against loan ledger.",
            AdvisoryOnly = true,
            ModelName = "heuristic-fallback-v1",
            CreatedAt = DateTimeOffset.UtcNow
        };
    }

    public async Task<AiAnalysisDto> ExplainExceptionAsync(DiscrepancyException exception, Transaction? internalTxn, Transaction? externalTxn, CancellationToken cancellationToken = default)
    {
        var analysisId = Guid.NewGuid();
        var payload = new
        {
            analysisId = analysisId.ToString(),
            exceptionType = exception.ExceptionType,
            evidence = new
            {
                referenceMatch = internalTxn?.TransactionReference == externalTxn?.TransactionReference,
                internalAmount = internalTxn?.Amount.ToString("F2") ?? exception.ExpectedAmount?.ToString("F2") ?? "0.00",
                externalAmount = externalTxn?.Amount.ToString("F2") ?? exception.ActualAmount?.ToString("F2") ?? "0.00",
                currency = internalTxn?.Currency ?? externalTxn?.Currency ?? "INR",
                dateDifferenceDays = (internalTxn != null && externalTxn != null) ? (int)Math.Abs((internalTxn.TransactionDate - externalTxn.TransactionDate).TotalDays) : 0
            }
        };

        try
        {
            var request = new HttpRequestMessage(HttpMethod.Post, "/internal/v1/exception-explanation")
            {
                Content = JsonContent.Create(payload)
            };
            request.Headers.Add("X-Service-Key", _serviceKey);

            var response = await _httpClient.SendAsync(request, cancellationToken);
            if (response.IsSuccessStatusCode)
            {
                var result = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: cancellationToken);
                return new AiAnalysisDto
                {
                    AnalysisId = analysisId,
                    Status = AiAnalysisStatus.Completed,
                    AnalysisType = AiAnalysisType.Explanation,
                    Summary = result.GetProperty("summary").GetString(),
                    Evidence = result.GetProperty("evidenceReferences"),
                    Recommendation = result.GetProperty("recommendedReview").GetString(),
                    AdvisoryOnly = true,
                    ModelName = result.TryGetProperty("modelVersion", out var mv) && !string.IsNullOrWhiteSpace(mv.GetString()) 
                        ? mv.GetString() 
                        : (result.TryGetProperty("model", out var m) && !string.IsNullOrWhiteSpace(m.GetString()) ? m.GetString() : "nvidia/nemotron-3.5-bolt-e4b"),
                    CreatedAt = DateTimeOffset.UtcNow
                };
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to call AI microservice explanation, generating evidence-grounded advisory explanation.");
        }

        // Resilient deterministic explanation
        var curr = internalTxn?.Currency ?? externalTxn?.Currency ?? "INR";
        var summary = exception.ExceptionType switch
        {
            ExceptionType.AmountMismatch => $"The transaction amounts differ by {curr} {exception.DiscrepancyAmount:N2}. Expected {curr} {exception.ExpectedAmount:N2}, settlement was {curr} {exception.ActualAmount:N2}.",
            ExceptionType.MissingSettlement => $"Internal loan record for {curr} {exception.ExpectedAmount:N2} has no corresponding external settlement in the counterparty file.",
            ExceptionType.UnmatchedExternal => $"External counterparty settlement of {curr} {exception.ActualAmount:N2} was received without a matching internal lending transaction.",
            ExceptionType.PartialSettlement => $"Partial settlement received: {curr} {exception.ActualAmount:N2} of expected {curr} {exception.ExpectedAmount:N2}. Outstanding: {curr} {exception.DiscrepancyAmount:N2}.",
            ExceptionType.AmbiguousMatch => "Multiple external candidates matched the candidate criteria; requires human adjudication.",
            _ => $"Discrepancy requiring human investigation under rule: {exception.ExceptionType}."
        };

        return new AiAnalysisDto
        {
            AnalysisId = analysisId,
            Status = AiAnalysisStatus.Completed,
            AnalysisType = AiAnalysisType.Explanation,
            Summary = summary,
            Evidence = new { internalAmount = exception.ExpectedAmount, externalAmount = exception.ActualAmount },
            Recommendation = "Inspect counterparty settlement records and customer payment receipts.",
            AdvisoryOnly = true,
            ModelName = "evidence-explainer-v1",
            CreatedAt = DateTimeOffset.UtcNow
        };
    }
}
