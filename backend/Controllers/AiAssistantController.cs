using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace LendGuard.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AiAssistantController : ControllerBase
    {
        private readonly LendGuardContext _context;
        private readonly IHttpClientFactory _httpClientFactory;

        public AiAssistantController(LendGuardContext context, IHttpClientFactory httpClientFactory)
        {
            _context = context;
            _httpClientFactory = httpClientFactory;
        }

        public class QueryRequestDto
        {
            public string Query { get; set; } = string.Empty;
            public string? TargetReferenceId { get; set; }
        }

        [HttpPost("query")]
        public async Task<IActionResult> ResolveQuery([FromBody] QueryRequestDto request)
        {
            if (string.IsNullOrWhiteSpace(request.Query))
            {
                return BadRequest(new { message = "Query cannot be empty." });
            }

            // 1. Gather live operational context
            var txCount = await _context.Transactions.CountAsync();
            var matchedCount = await _context.Transactions.CountAsync(t => t.ReconciliationStatus == "Matched");
            var unmatchedCount = await _context.Transactions.CountAsync(t => t.ReconciliationStatus == "Discrepancy" || t.ReconciliationStatus == "Pending");
            var openExCount = await _context.Exceptions.CountAsync(e => e.Status == "Open" || e.Status == "Assigned" || e.Status == "In Progress");
            var resolvedExCount = await _context.Exceptions.CountAsync(e => e.Status == "Resolved" || e.Status == "Closed");
            
            decimal successRate = txCount > 0 
                ? Math.Round(((decimal)matchedCount / txCount) * 100m, 2)
                : 0.00m;

            var recentExceptions = await _context.Exceptions
                .AsNoTracking()
                .OrderByDescending(e => e.CreatedDate)
                .Take(20)
                .Select(e => new
                {
                    e.Id,
                    e.TransactionReference,
                    e.ExceptionType,
                    e.Severity,
                    e.Amount,
                    e.Status,
                    e.Description
                })
                .ToListAsync();

            // Check if specific reference mentioned
            string? foundRef = request.TargetReferenceId;
            if (string.IsNullOrWhiteSpace(foundRef))
            {
                var match = System.Text.RegularExpressions.Regex.Match(request.Query, @"\b(TXN[_\-]?\d+)\b", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                if (match.Success)
                {
                    foundRef = match.Groups[1].Value.ToUpper().Replace("-", "_");
                }
            }

            Transaction? targetTx = null;
            ExceptionRecord? targetEx = null;
            if (!string.IsNullOrWhiteSpace(foundRef))
            {
                targetTx = await _context.Transactions
                    .FirstOrDefaultAsync(t => t.ReferenceId == foundRef);
                targetEx = await _context.Exceptions
                    .FirstOrDefaultAsync(e => e.TransactionReference == foundRef);
            }

            var aiPayload = new
            {
                query = request.Query,
                user_role = "Operations Analyst",
                context_metrics = new
                {
                    totalTransactions = txCount,
                    matchedTransactions = matchedCount,
                    unmatchedTransactions = unmatchedCount,
                    openExceptions = openExCount,
                    resolvedExceptions = resolvedExCount,
                    successRate = (double)successRate
                },
                recent_exceptions = recentExceptions,
                target_transaction = targetTx == null ? null : new
                {
                    referenceId = targetTx.ReferenceId,
                    amount = (double)targetTx.Amount,
                    sourceSystem = targetTx.SourceSystem,
                    status = targetTx.ReconciliationStatus
                },
                target_exception = targetEx == null ? null : new
                {
                    id = targetEx.Id,
                    transactionReference = targetEx.TransactionReference,
                    exceptionType = targetEx.ExceptionType,
                    severity = targetEx.Severity,
                    amount = (double)targetEx.Amount,
                    status = targetEx.Status,
                    description = targetEx.Description,
                    evidence = targetEx.Evidence
                }
            };

            // Call Python AI microservice
            string aiServiceUrl = Environment.GetEnvironmentVariable("AIService__BaseUrl") ?? "http://localhost:8000";
            var client = _httpClientFactory.CreateClient();

            try
            {
                var jsonOptions = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
                var response = await client.PostAsync(
                    $"{aiServiceUrl}/resolve-query",
                    new StringContent(JsonSerializer.Serialize(aiPayload, jsonOptions), Encoding.UTF8, "application/json")
                );

                if (response.IsSuccessStatusCode)
                {
                    var responseJson = await response.Content.ReadAsStringAsync();
                    return Content(responseJson, "application/json");
                }
            }
            catch (Exception)
            {
                // Fallback internal intelligent resolution if AI service is starting or isolated
            }

            // Fallback C# heuristic response
            return Ok(new
            {
                query = request.Query,
                intent = "fallback_ledger_audit",
                confidence = 0.90,
                summary = $"Live Ledger Context: {txCount} total transactions, {matchedCount} matched, {openExCount} open exceptions. Reconciliation rate is {successRate}%.",
                detailed_answer = $"### LendGuard AI Financial Ledger Diagnostic\n\n" +
                                  $"- **Total Transactions:** {txCount}\n" +
                                  $"- **Matched & Settled:** {matchedCount}\n" +
                                  $"- **Unmatched Discrepancies:** {unmatchedCount}\n" +
                                  $"- **Open Exceptions:** {openExCount}\n" +
                                  $"- **Reconciliation Rate:** {successRate}%\n\n" +
                                  $"Query analyzed: *\"{request.Query}\"*\n\n" +
                                  $"Recommended action: Review the Exceptions Management tab and run the reconciliation engine to refresh settlement batches.",
                metrics = new { totalTransactions = txCount, matchedTransactions = matchedCount, openExceptions = openExCount, successRate = (double)successRate },
                action_items = new[]
                {
                    "Inspect open discrepancy records in the Exception Management tab.",
                    "Verify counterpart banking entries for unmatched references."
                },
                suggested_followups = new[]
                {
                    "What is our reconciliation rate?",
                    "Show high-risk anomalies",
                    "How do I resolve an exception?"
                },
                related_references = recentExceptions.Take(3).Select(e => e.TransactionReference).ToArray()
            });
        }

        [HttpGet("suggested-queries")]
        public IActionResult GetSuggestedQueries()
        {
            var suggestions = new[]
            {
                new { title = "Ledger Health", query = "What is our current reconciliation rate and operational health?" },
                new { title = "High-Risk Outliers", query = "Show me the highest risk anomalies and outlier transactions." },
                new { title = "Audit TXN_1005", query = "Why is transaction TXN_1005 flagged with an amount mismatch?" },
                new { title = "Duplicate Charges", query = "How do I resolve duplicate settlement errors?" },
                new { title = "Discrepancy Breakdown", query = "What types of reconciliation exceptions were detected?" },
                new { title = "Resolution SOP", query = "What are the approved categories and workflow to resolve an exception?" }
            };

            return Ok(suggestions);
        }
    }
}
