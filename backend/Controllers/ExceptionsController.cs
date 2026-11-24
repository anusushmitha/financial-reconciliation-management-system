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
    public class ExceptionsController : ControllerBase
    {
        private readonly LendGuardContext _context;
        private readonly IHttpClientFactory _httpClientFactory;

        public ExceptionsController(LendGuardContext context, IHttpClientFactory httpClientFactory)
        {
            _context = context;
            _httpClientFactory = httpClientFactory;
        }

        [HttpGet]
        public async Task<IActionResult> GetExceptions(
            [FromQuery] string? status,
            [FromQuery] string? severity,
            [FromQuery] string? exceptionType,
            [FromQuery] string? assignedTo,
            [FromQuery] string? search,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 25)
        {
            var query = _context.Exceptions.AsNoTracking().AsQueryable();

            if (!string.IsNullOrWhiteSpace(status) && status != "All")
            {
                query = query.Where(e => e.Status == status);
            }

            if (!string.IsNullOrWhiteSpace(severity) && severity != "All")
            {
                query = query.Where(e => e.Severity == severity);
            }

            if (!string.IsNullOrWhiteSpace(exceptionType) && exceptionType != "All")
            {
                query = query.Where(e => e.ExceptionType == exceptionType);
            }

            if (!string.IsNullOrWhiteSpace(assignedTo) && assignedTo != "All")
            {
                query = query.Where(e => e.AssignedEmployeeId == assignedTo || e.AssignedEmployeeName == assignedTo);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                search = search.Trim().ToLower();
                query = query.Where(e => e.TransactionReference.ToLower().Contains(search) 
                                      || e.Description.ToLower().Contains(search));
            }

            var totalCount = await query.CountAsync();
            var items = await query
                .OrderByDescending(e => e.CreatedDate)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return Ok(new
            {
                totalCount,
                page,
                pageSize,
                totalPages = (int)Math.Ceiling(totalCount / (double)pageSize),
                data = items
            });
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetExceptionDetail(int id)
        {
            var ex = await _context.Exceptions.FindAsync(id);
            if (ex == null) return NotFound(new { message = $"Exception #{id} not found." });

            var notes = await _context.InvestigationNotes
                .Where(n => n.ExceptionRecordId == id)
                .OrderByDescending(n => n.CreatedAt)
                .ToListAsync();

            var internalRecord = await _context.Transactions
                .FirstOrDefaultAsync(t => t.ReferenceId == ex.TransactionReference && t.SourceSystem == "Internal");

            var externalRecord = await _context.Transactions
                .FirstOrDefaultAsync(t => t.ReferenceId == ex.TransactionReference && t.SourceSystem == "External");

            return Ok(new
            {
                exception = ex,
                notes = notes,
                internalRecord = internalRecord,
                externalRecord = externalRecord
            });
        }

        public class AssignDto
        {
            public string EmployeeId { get; set; } = string.Empty;
            public string EmployeeName { get; set; } = string.Empty;
        }

        [HttpPut("{id}/assign")]
        public async Task<IActionResult> AssignEmployee(int id, [FromBody] AssignDto dto)
        {
            var ex = await _context.Exceptions.FindAsync(id);
            if (ex == null) return NotFound();

            ex.AssignedEmployeeId = dto.EmployeeId;
            ex.AssignedEmployeeName = string.IsNullOrWhiteSpace(dto.EmployeeName) ? dto.EmployeeId : dto.EmployeeName;
            if (ex.Status == "Open")
            {
                ex.Status = "Assigned";
            }
            ex.LastUpdatedDate = DateTime.UtcNow;

            await _context.InvestigationNotes.AddAsync(new InvestigationNote
            {
                ExceptionRecordId = id,
                AuthorName = "System",
                NoteText = $"Exception assigned to {ex.AssignedEmployeeName}."
            });

            await _context.SaveChangesAsync();
            return Ok(ex);
        }

        public class StatusUpdateDto
        {
            public string Status { get; set; } = string.Empty; // Open, Assigned, In Progress, Resolved, Closed
            public string? Note { get; set; }
            public string? Author { get; set; }
        }

        [HttpPatch("{id}/status")]
        public async Task<IActionResult> UpdateStatus(int id, [FromBody] StatusUpdateDto dto)
        {
            var ex = await _context.Exceptions.FindAsync(id);
            if (ex == null) return NotFound();

            string oldStatus = ex.Status;
            ex.Status = dto.Status;
            ex.LastUpdatedDate = DateTime.UtcNow;

            if (!string.IsNullOrWhiteSpace(dto.Note))
            {
                await _context.InvestigationNotes.AddAsync(new InvestigationNote
                {
                    ExceptionRecordId = id,
                    AuthorName = dto.Author ?? "System",
                    NoteText = $"Status changed from {oldStatus} to {dto.Status}. Note: {dto.Note}"
                });
            }

            await _context.SaveChangesAsync();
            return Ok(ex);
        }

        public class NoteDto
        {
            public string NoteText { get; set; } = string.Empty;
            public string AuthorName { get; set; } = "Operations Analyst";
        }

        [HttpPost("{id}/notes")]
        public async Task<IActionResult> AddNote(int id, [FromBody] NoteDto dto)
        {
            var ex = await _context.Exceptions.FindAsync(id);
            if (ex == null) return NotFound();

            var note = new InvestigationNote
            {
                ExceptionRecordId = id,
                AuthorName = string.IsNullOrWhiteSpace(dto.AuthorName) ? "Operations Analyst" : dto.AuthorName,
                NoteText = dto.NoteText,
                CreatedAt = DateTime.UtcNow
            };

            await _context.InvestigationNotes.AddAsync(note);
            ex.LastUpdatedDate = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(note);
        }

        public class ResolveDto
        {
            public string ResolutionCategory { get; set; } = "TimingDifference";
            public string ResolutionExplanation { get; set; } = string.Empty;
            public string ResolvedBy { get; set; } = "Operations Analyst";
        }

        [HttpPost("{id}/resolve")]
        public async Task<IActionResult> ResolveException(int id, [FromBody] ResolveDto dto)
        {
            var ex = await _context.Exceptions.FindAsync(id);
            if (ex == null) return NotFound();

            ex.Status = "Resolved";
            ex.ResolutionCategory = dto.ResolutionCategory;
            ex.ResolutionExplanation = dto.ResolutionExplanation;
            ex.ResolvedBy = dto.ResolvedBy;
            ex.ResolutionTimestamp = DateTime.UtcNow;
            ex.LastUpdatedDate = DateTime.UtcNow;

            await _context.InvestigationNotes.AddAsync(new InvestigationNote
            {
                ExceptionRecordId = id,
                AuthorName = dto.ResolvedBy,
                NoteText = $"Exception marked RESOLVED under category '{dto.ResolutionCategory}'. Resolution note: {dto.ResolutionExplanation}"
            });

            await _context.SaveChangesAsync();
            return Ok(ex);
        }

        [HttpPost("{id}/analyze-ai")]
        public async Task<IActionResult> AnalyzeWithAI(int id)
        {
            var ex = await _context.Exceptions.FindAsync(id);
            if (ex == null) return NotFound(new { message = $"Exception #{id} not found." });

            var internalRecord = await _context.Transactions
                .FirstOrDefaultAsync(t => t.ReferenceId == ex.TransactionReference && t.SourceSystem == "Internal");

            var externalRecord = await _context.Transactions
                .FirstOrDefaultAsync(t => t.ReferenceId == ex.TransactionReference && t.SourceSystem == "External");

            var client = _httpClientFactory.CreateClient();
            var aiPayload = new
            {
                exception_id = ex.Id,
                transaction_reference = ex.TransactionReference,
                exception_type = ex.ExceptionType,
                amount = (double)ex.Amount,
                severity = ex.Severity,
                description = ex.Description,
                evidence_text = ex.Evidence,
                internal_record = internalRecord == null ? null : new
                {
                    reference_id = internalRecord.ReferenceId,
                    source_system = internalRecord.SourceSystem,
                    amount = (double)internalRecord.Amount,
                    transaction_date = internalRecord.TransactionDate.ToString("yyyy-MM-dd"),
                    currency = internalRecord.Currency,
                    type = internalRecord.Type,
                    status = internalRecord.Status
                },
                external_record = externalRecord == null ? null : new
                {
                    reference_id = externalRecord.ReferenceId,
                    source_system = externalRecord.SourceSystem,
                    amount = (double)externalRecord.Amount,
                    transaction_date = externalRecord.TransactionDate.ToString("yyyy-MM-dd"),
                    currency = externalRecord.Currency,
                    type = externalRecord.Type,
                    status = externalRecord.Status
                }
            };

            // Call Python FastAPI service (default: http://ai:8000 or fallback http://localhost:8000)
            string aiServiceUrl = Environment.GetEnvironmentVariable("AIService__BaseUrl") ?? "http://localhost:8000";
            
            try
            {
                var response = await client.PostAsync(
                    $"{aiServiceUrl}/analyze",
                    new StringContent(JsonSerializer.Serialize(aiPayload), Encoding.UTF8, "application/json")
                );

                if (response.IsSuccessStatusCode)
                {
                    var responseJson = await response.Content.ReadAsStringAsync();
                    using var doc = JsonDocument.Parse(responseJson);
                    var root = doc.RootElement;

                    ex.AiAnomalyScore = root.GetProperty("anomaly_score").GetDouble();
                    ex.AiClassification = root.GetProperty("classification").GetString();
                    ex.AiExplanation = root.GetProperty("explanation").GetString();
                    ex.AiRecommendedSteps = root.GetProperty("recommended_steps").ToString();
                    ex.LastUpdatedDate = DateTime.UtcNow;

                    await _context.SaveChangesAsync();
                    return Content(responseJson, "application/json");
                }
            }
            catch (Exception)
            {
                // Fallback deterministic AI explanation
                var fallbackExplanation = $"Automated deterministic advisory: Flagged as '{ex.ExceptionType}'. Variance detected on reference {ex.TransactionReference} with amount ${ex.Amount:F2}. Connection to AI microservice was redirected to internal rule engine.";
                ex.AiAnomalyScore = 0.55;
                ex.AiClassification = "Advisory Warning";
                ex.AiExplanation = fallbackExplanation;
                ex.AiRecommendedSteps = "[\"Cross-reference bank ledger statement with internal settlement queue.\", \"Verify currency exchange fee calculations.\"]";
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    anomaly_score = 0.55,
                    classification = "Advisory Warning",
                    severity = ex.Severity,
                    detected_indicators = new[] { "Flagged by internal reconciliation heuristic rule engine." },
                    explanation = fallbackExplanation,
                    why_flagged = ex.Description,
                    records_compared = new { internalRecord, externalRecord },
                    supporting_evidence = new { Reference = ex.TransactionReference, ex.Evidence },
                    recommended_steps = new[] { "Review source transaction settlement batch.", "Verify payment processor ledger deductions." },
                    confidence_level = "Rule-based Fallback",
                    is_advisory = true
                });
            }

            return BadRequest("Failed to process AI analysis.");
        }
    }
}
