using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using LendGuard.Application.Common.Interfaces;
using LendGuard.Application.DTOs;
using LendGuard.Domain;
using LendGuard.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace LendGuard.Infrastructure.Services;

public class AiClientService : IAiClientService
{
    private readonly HttpClient _httpClient;
    private readonly string _serviceKey;
    private readonly ILogger<AiClientService> _logger;
    private readonly IServiceScopeFactory? _scopeFactory;

    public AiClientService(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<AiClientService> logger,
        IServiceScopeFactory? scopeFactory = null)
    {
        _httpClient = httpClient;
        _logger = logger;
        _scopeFactory = scopeFactory;
        _serviceKey = configuration["AI_SERVICE_KEY"] ?? "lendguard_internal_ai_secret_key_2026";

        var baseUrl = configuration["AI_SERVICE_BASE_URL"] ?? "http://localhost:8000";
        _httpClient.BaseAddress = new Uri(baseUrl);
        _httpClient.Timeout = TimeSpan.FromSeconds(15);
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

        // Explicit AI-Offline fallback when AI microservice is unreachable
        var fallbackCurrency = effectiveTxn?.Currency ?? "INR";
        var fallbackScore = (exception.DiscrepancyAmount > 5000) ? 0.85 : 0.35;
        var fallbackRisk = fallbackScore >= 0.8 ? "CRITICAL" : "MODERATE";
        return new AiAnalysisDto
        {
            AnalysisId = analysisId,
            Status = AiAnalysisStatus.Completed,
            AnalysisType = AiAnalysisType.Anomaly,
            Summary = $"AI ML service is currently offline and will be back shortly. Standard reference while AI is offline: magnitude {fallbackCurrency} {exception.DiscrepancyAmount:N2} ({fallbackRisk} tier).",
            Evidence = new
            {
                anomalyScore = fallbackScore,
                riskLevel = fallbackRisk,
                signals = (exception.DiscrepancyAmount > 5000) ? new[] { "CRITICAL_AMOUNT_DEVIATION" } : new[] { "MINOR_VARIANCE_TOLERANCE" },
                algorithm = "AI Offline — Standard Magnitude Reference",
                modelVersion = "ai-offline-standard-fallback",
                advisoryOnly = true
            },
            Recommendation = "Verify settlement advice against loan ledger while AI service reconnects.",
            AdvisoryOnly = true,
            ModelName = "ai-offline-standard-fallback",
            CreatedAt = DateTimeOffset.UtcNow
        };
    }

    public async Task<AiAnalysisDto> ExplainExceptionAsync(DiscrepancyException exception, Transaction? internalTxn, Transaction? externalTxn, CancellationToken cancellationToken = default)
    {
        var analysisId = Guid.NewGuid();
        object? policyContext = null;
        List<object>? historicalResolutions = null;
        object? anomalyContext = null;

        if (_scopeFactory != null)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetService<IApplicationDbContext>();
                if (db != null)
                {
                    var activePolicy = await db.ReconciliationPolicies
                        .AsNoTracking()
                        .OrderByDescending(p => p.UpdatedAt)
                        .FirstOrDefaultAsync(cancellationToken);
                    if (activePolicy != null)
                    {
                        policyContext = new
                        {
                            profileId = activePolicy.ProfileId,
                            amountTolerancePercent = activePolicy.AmountTolerancePercent,
                            fixedRupeeTolerance = activePolicy.FixedRupeeTolerance,
                            dateSlippageDays = activePolicy.DateSlippageDays,
                            outlierThreshold = activePolicy.IsolationForestOutlierThreshold
                        };
                    }

                    var pastResolved = await db.Exceptions
                        .AsNoTracking()
                        .Where(e => e.Status == ExceptionStatus.Resolved && e.Id != exception.Id)
                        .OrderByDescending(e => e.ExceptionType == exception.ExceptionType)
                        .ThenByDescending(e => e.ResolvedAt)
                        .Take(3)
                        .Select(e => new
                        {
                            exceptionType = e.ExceptionType,
                            resolutionCategory = e.ResolutionCategory,
                            resolutionExplanation = e.ResolutionExplanation,
                            discrepancyAmount = e.DiscrepancyAmount
                        })
                        .ToListAsync(cancellationToken);
                    if (pastResolved.Count > 0)
                    {
                        historicalResolutions = pastResolved.Cast<object>().ToList();
                    }

                    var latestAnomaly = await db.AiAnalyses
                        .AsNoTracking()
                        .Where(a => a.ExceptionId == exception.Id && a.AnalysisType == AiAnalysisType.Anomaly)
                        .OrderByDescending(a => a.CreatedAt)
                        .Select(a => new { a.ModelName, a.Result })
                        .FirstOrDefaultAsync(cancellationToken);
                    if (latestAnomaly != null)
                    {
                        anomalyContext = new
                        {
                            modelName = latestAnomaly.ModelName,
                            summary = latestAnomaly.Result
                        };
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Skipping optional DB context enrichment for AI explanation.");
            }
        }

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
                dateDifferenceDays = (internalTxn != null && externalTxn != null) ? (int)Math.Abs((internalTxn.TransactionDate - externalTxn.TransactionDate).TotalDays) : 0,
                transactionType = internalTxn?.TransactionType ?? externalTxn?.TransactionType,
                policyContext,
                historicalResolutions,
                anomalyContext
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
            Summary = $"AI explanation service is currently offline and will be back shortly. Standard rule reference while AI is offline: {summary}",
            Evidence = new { internalAmount = exception.ExpectedAmount, externalAmount = exception.ActualAmount, aiOffline = true },
            Recommendation = "Inspect counterparty settlement records and customer payment receipts while AI reconnects.",
            AdvisoryOnly = true,
            ModelName = "ai-offline-standard-fallback",
            CreatedAt = DateTimeOffset.UtcNow
        };
    }

    public async Task<bool> CalibrateModelAsync(IEnumerable<Transaction> transactions, CancellationToken cancellationToken = default)
    {
        var samples = transactions.Select(t => new
        {
            amount = (double)t.Amount,
            currency = string.IsNullOrWhiteSpace(t.Currency) ? "INR" : t.Currency.Trim().ToUpperInvariant(),
            deviation = 0.0,
            dateDifferenceDays = 0.0,
            isAnomaly = (bool?)null,
            resolutionCategory = (string?)null
        }).ToList();

        if (_scopeFactory != null)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetService<IApplicationDbContext>();
                if (db != null)
                {
                    var resolvedExceptions = await db.Exceptions
                        .AsNoTracking()
                        .Include(e => e.InternalTransaction)
                        .Include(e => e.ExternalTransaction)
                        .Where(e => e.Status == ExceptionStatus.Resolved)
                        .OrderByDescending(e => e.ResolvedAt)
                        .Take(200)
                        .ToListAsync(cancellationToken);

                    foreach (var ex in resolvedExceptions)
                    {
                        var txn = ex.InternalTransaction ?? ex.ExternalTransaction;
                        var cat = (ex.ResolutionCategory ?? string.Empty).Trim().ToUpperInvariant();
                        var isFalsePositiveOrTiming = cat.Contains("TIMING") || cat.Contains("FALSE") || cat.Contains("TOLERANCE") || cat.Contains("CLEARED");
                        var isConfirmedAnomaly = !isFalsePositiveOrTiming && ((ex.DiscrepancyAmount ?? 0m) > 0m || cat.Contains("FRAUD") || cat.Contains("DUPLICATE") || cat.Contains("WRITE_OFF"));
                        var dateDiff = (ex.InternalTransaction != null && ex.ExternalTransaction != null)
                            ? Math.Abs((ex.InternalTransaction.TransactionDate - ex.ExternalTransaction.TransactionDate).TotalDays)
                            : 0.0;

                        samples.Add(new
                        {
                            amount = (double)(txn?.Amount ?? ex.ExpectedAmount ?? ex.ActualAmount ?? 0m),
                            currency = string.IsNullOrWhiteSpace(txn?.Currency) ? "INR" : txn!.Currency.Trim().ToUpperInvariant(),
                            deviation = (double)(ex.DiscrepancyAmount ?? 0m),
                            dateDifferenceDays = dateDiff,
                            isAnomaly = (bool?)isConfirmedAnomaly,
                            resolutionCategory = ex.ResolutionCategory
                        });
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Skipping optional labeled exception feedback during calibration.");
            }
        }

        if (samples.Count == 0)
        {
            return false;
        }

        try
        {
            var request = new HttpRequestMessage(HttpMethod.Post, "/internal/v1/calibrate")
            {
                Content = JsonContent.Create(new { samples })
            };
            request.Headers.Add("X-Service-Key", _serviceKey);

            var response = await _httpClient.SendAsync(request, cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to calibrate AI anomaly model against live portfolio.");
            return false;
        }
    }
}
