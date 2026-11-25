using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using LendGuard.Application.Common.Interfaces;
using LendGuard.Application.Common.Models;
using LendGuard.Application.DTOs;
using LendGuard.Domain;
using LendGuard.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace LendGuard.Application.Services;

public interface IExceptionService
{
    Task<PaginatedList<ExceptionSummaryDto>> GetExceptionsAsync(int page = 1, int pageSize = 20, string? type = null, string? severity = null, string? status = null, Guid? assignedTo = null, bool? unassignedOnly = null, Guid? currentUserId = null, string? currentUserRole = null, CancellationToken cancellationToken = default);
    Task<ExceptionDetailDto> GetExceptionByIdAsync(Guid id, Guid currentUserId, string currentUserRole, CancellationToken cancellationToken = default);
    Task<ExceptionDetailDto> AssignExceptionAsync(Guid id, AssignExceptionRequest request, Guid currentUserId, string currentUserRole = UserRole.Admin, CancellationToken cancellationToken = default);
    Task<BatchAssignExceptionsResponse> BatchAssignExceptionsAsync(BatchAssignExceptionsRequest request, Guid currentUserId, string currentUserRole = UserRole.Admin, CancellationToken cancellationToken = default);
    Task<List<InvestigationNoteDto>> GetExceptionNotesAsync(Guid id, CancellationToken cancellationToken = default);
    Task<InvestigationNoteDto> AddInvestigationNoteAsync(Guid id, AddInvestigationNoteRequest request, Guid currentUserId, string currentUserRole = UserRole.Admin, CancellationToken cancellationToken = default);
    Task<ExceptionDetailDto> ResolveExceptionAsync(Guid id, ResolveExceptionRequest request, Guid currentUserId, string currentUserRole = UserRole.Admin, CancellationToken cancellationToken = default);
    Task<TriggerAiAnalysisResponse> TriggerAiAnalysisAsync(Guid id, TriggerAiAnalysisRequest request, Guid currentUserId, string currentUserRole = UserRole.Admin, CancellationToken cancellationToken = default);
    Task<List<AiAnalysisDto>> GetExceptionAnalysesAsync(Guid id, bool latestOnly = false, string? type = null, CancellationToken cancellationToken = default);
}

public class ExceptionService : IExceptionService
{
    private readonly IApplicationDbContext _context;
    private readonly IAuditService _auditService;
    private readonly IAiClientService _aiClient;
    private readonly INotificationService? _notificationService;

    public ExceptionService(IApplicationDbContext context, IAuditService auditService, IAiClientService aiClient, INotificationService? notificationService = null)
    {
        _context = context;
        _auditService = auditService;
        _aiClient = aiClient;
        _notificationService = notificationService;
    }

    public async Task<PaginatedList<ExceptionSummaryDto>> GetExceptionsAsync(int page = 1, int pageSize = 20, string? type = null, string? severity = null, string? status = null, Guid? assignedTo = null, bool? unassignedOnly = null, Guid? currentUserId = null, string? currentUserRole = null, CancellationToken cancellationToken = default)
    {
        var query = _context.Exceptions.AsNoTracking()
            .Include(e => e.Assignee)
            .AsQueryable();

        // Assignment filtering & role-based scoping:
        if (unassignedOnly == true)
        {
            query = query.Where(e => e.AssignedTo == null);
        }
        else if (assignedTo.HasValue)
        {
            // Explicitly requested assignee (works for both Admin and Analyst filtering "Assigned to Me")
            query = query.Where(e => e.AssignedTo == assignedTo.Value);
        }
        else if (currentUserRole == UserRole.Analyst && currentUserId.HasValue)
        {
            // Default Analyst intake view: show exceptions assigned to them OR unassigned pool
            query = query.Where(e => e.AssignedTo == currentUserId.Value || e.AssignedTo == null);
        }

        if (!string.IsNullOrWhiteSpace(type))
        {
            query = query.Where(e => e.ExceptionType == type.Trim().ToUpper());
        }

        if (!string.IsNullOrWhiteSpace(severity))
        {
            query = query.Where(e => e.Severity == severity.Trim().ToUpper());
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var st = status.Trim().ToUpper();
            if (st == "ACTIVE")
            {
                query = query.Where(e => e.Status == ExceptionStatus.Open || e.Status == ExceptionStatus.InProgress);
            }
            else
            {
                query = query.Where(e => e.Status == st);
            }
        }

        var total = await query.CountAsync(cancellationToken);
        var items = await query.OrderByDescending(e => e.CreatedAt)
                               .Skip((page - 1) * pageSize)
                               .Take(pageSize)
                               .Select(e => new ExceptionSummaryDto
                               {
                                   Id = e.Id,
                                   ExceptionType = e.ExceptionType,
                                   Severity = e.Severity,
                                   Status = e.Status,
                                   DiscrepancyAmount = e.DiscrepancyAmount,
                                   Currency = "INR",
                                   AssignedTo = e.Assignee != null ? new UserProfileDto
                                   {
                                       Id = e.Assignee.Id,
                                       FullName = e.Assignee.FullName,
                                       Email = e.Assignee.Email,
                                       Role = e.Assignee.Role
                                   } : null,
                                   CreatedAt = e.CreatedAt
                               })
                               .ToListAsync(cancellationToken);

        return new PaginatedList<ExceptionSummaryDto>(items, total, page, pageSize);
    }

    public async Task<ExceptionDetailDto> GetExceptionByIdAsync(Guid id, Guid currentUserId, string currentUserRole, CancellationToken cancellationToken = default)
    {
        var exception = await _context.Exceptions.AsNoTracking()
            .Include(e => e.Assignee)
            .Include(e => e.Resolver)
            .Include(e => e.InternalTransaction)
            .Include(e => e.ExternalTransaction)
            .FirstOrDefaultAsync(e => e.Id == id, cancellationToken);

        if (exception == null)
        {
            throw new KeyNotFoundException("Exception record not found.");
        }

        // Authorization check for Analyst
        if (currentUserRole == UserRole.Analyst && exception.AssignedTo.HasValue && exception.AssignedTo.Value != currentUserId)
        {
            throw new UnauthorizedAccessException("You are not authorized to view this exception.");
        }

        return MapToDetailDto(exception);
    }

    public async Task<ExceptionDetailDto> AssignExceptionAsync(Guid id, AssignExceptionRequest request, Guid currentUserId, string currentUserRole = UserRole.Admin, CancellationToken cancellationToken = default)
    {
        // Enforce analyst self-assignment authorization before database existence lookup to prevent ID enumeration
        if (currentUserRole == UserRole.Analyst && request.AssignedTo != currentUserId)
        {
            throw new UnauthorizedAccessException("Analysts may only assign unassigned exceptions to themselves.");
        }

        var exception = await _context.Exceptions
            .Include(e => e.Assignee)
            .FirstOrDefaultAsync(e => e.Id == id, cancellationToken);

        if (exception == null)
        {
            throw new KeyNotFoundException("Exception record not found.");
        }

        if (currentUserRole == UserRole.Analyst && exception.AssignedTo.HasValue && exception.AssignedTo.Value != currentUserId)
        {
            throw new UnauthorizedAccessException("Cannot claim an exception already assigned to another analyst.");
        }

        var targetUser = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == request.AssignedTo, cancellationToken);
        if (targetUser == null || !targetUser.IsActive)
        {
            throw new ArgumentException("Assigned user must be an active account.");
        }

        var oldAssigneeId = exception.AssignedTo;
        exception.AssignedTo = targetUser.Id;
        if (exception.Status == ExceptionStatus.Open)
        {
            exception.Status = ExceptionStatus.InProgress;
        }
        exception.UpdatedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync("EXCEPTION_ASSIGNED", "EXCEPTION", exception.Id, currentUserId, new { oldAssignee = oldAssigneeId, newAssignee = targetUser.Id, assigneeName = targetUser.FullName }, null, cancellationToken);

        if (_notificationService != null)
        {
            await _notificationService.BroadcastEventAsync("EXCEPTION_ASSIGNED", "Discrepancy Assigned", $"{targetUser.FullName} was assigned discrepancy #{exception.Id.ToString()[..8]}.", new { exceptionId = exception.Id, assignedTo = targetUser.Id, assigneeName = targetUser.FullName }, cancellationToken);
        }

        return await GetExceptionByIdAsync(id, currentUserId, UserRole.Admin, cancellationToken);
    }

    public async Task<BatchAssignExceptionsResponse> BatchAssignExceptionsAsync(BatchAssignExceptionsRequest request, Guid currentUserId, string currentUserRole = UserRole.Admin, CancellationToken cancellationToken = default)
    {
        if (request.ExceptionIds == null || request.ExceptionIds.Count == 0)
        {
            return new BatchAssignExceptionsResponse { AssignedCount = 0 };
        }

        var targetUser = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == request.AssignedTo, cancellationToken);
        if (targetUser == null || !targetUser.IsActive)
        {
            throw new ArgumentException("Target assignee must be an active registered user.");
        }

        if (currentUserRole == UserRole.Analyst && request.AssignedTo != currentUserId)
        {
            throw new UnauthorizedAccessException("Analysts may only batch assign unassigned items to themselves.");
        }

        var exceptions = await _context.Exceptions
            .Where(e => request.ExceptionIds.Contains(e.Id))
            .ToListAsync(cancellationToken);

        var updatedIds = new List<Guid>();
        foreach (var ex in exceptions)
        {
            if (currentUserRole == UserRole.Analyst && ex.AssignedTo.HasValue && ex.AssignedTo.Value != currentUserId)
            {
                // Skip items assigned to someone else for analyst
                continue;
            }

            var oldAssignee = ex.AssignedTo;
            ex.AssignedTo = targetUser.Id;
            if (ex.Status == ExceptionStatus.Open)
            {
                ex.Status = ExceptionStatus.InProgress;
            }
            ex.UpdatedAt = DateTimeOffset.UtcNow;
            updatedIds.Add(ex.Id);

            await _auditService.LogAsync("EXCEPTION_ASSIGNED", "EXCEPTION", ex.Id, currentUserId, new { oldAssignee = oldAssignee, newAssignee = targetUser.Id, assigneeName = targetUser.FullName, batch = true }, null, cancellationToken);
        }

        await _context.SaveChangesAsync(cancellationToken);

        if (_notificationService != null && updatedIds.Count > 0)
        {
            await _notificationService.BroadcastEventAsync("BATCH_ASSIGNED", "Batch Triage Complete", $"{updatedIds.Count} discrepancies were assigned to {targetUser.FullName}.", new { count = updatedIds.Count, assignedTo = targetUser.Id, assigneeName = targetUser.FullName }, cancellationToken);
        }

        return new BatchAssignExceptionsResponse
        {
            AssignedCount = updatedIds.Count,
            UpdatedIds = updatedIds
        };
    }

    public async Task<List<InvestigationNoteDto>> GetExceptionNotesAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _context.InvestigationNotes.AsNoTracking()
            .Where(n => n.ExceptionId == id)
            .Include(n => n.User)
            .OrderBy(n => n.CreatedAt)
            .Select(n => new InvestigationNoteDto
            {
                Id = n.Id,
                ExceptionId = n.ExceptionId,
                UserId = n.UserId,
                UserName = n.User != null ? n.User.FullName : "System User",
                Note = n.Note,
                CreatedAt = n.CreatedAt
            })
            .ToListAsync(cancellationToken);
    }

    public async Task<InvestigationNoteDto> AddInvestigationNoteAsync(Guid id, AddInvestigationNoteRequest request, Guid currentUserId, string currentUserRole = UserRole.Admin, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Note))
        {
            throw new ArgumentException("Note cannot be empty.");
        }

        var exception = await _context.Exceptions.FirstOrDefaultAsync(e => e.Id == id, cancellationToken);
        if (exception == null)
        {
            throw new KeyNotFoundException("Exception not found.");
        }

        if (currentUserRole == UserRole.Analyst && exception.AssignedTo.HasValue && exception.AssignedTo.Value != currentUserId)
        {
            throw new UnauthorizedAccessException("You are not authorized to act on an exception assigned to another analyst.");
        }

        var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == currentUserId, cancellationToken);

        var note = new InvestigationNote
        {
            Id = Guid.NewGuid(),
            ExceptionId = id,
            UserId = currentUserId,
            Note = request.Note.Trim(),
            CreatedAt = DateTimeOffset.UtcNow
        };

        _context.InvestigationNotes.Add(note);
        exception.UpdatedAt = DateTimeOffset.UtcNow;
        if (exception.Status == ExceptionStatus.Open)
        {
            exception.Status = ExceptionStatus.InProgress;
        }

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync("INVESTIGATION_NOTE_ADDED", "EXCEPTION", exception.Id, currentUserId, new { noteId = note.Id }, null, cancellationToken);

        return new InvestigationNoteDto
        {
            Id = note.Id,
            ExceptionId = note.ExceptionId,
            UserId = note.UserId,
            UserName = user?.FullName,
            Note = note.Note,
            CreatedAt = note.CreatedAt
        };
    }

    public async Task<ExceptionDetailDto> ResolveExceptionAsync(Guid id, ResolveExceptionRequest request, Guid currentUserId, string currentUserRole = UserRole.Admin, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.ResolutionCategory))
        {
            throw new ArgumentException("Resolution category is required.");
        }

        if (string.IsNullOrWhiteSpace(request.Explanation))
        {
            throw new ArgumentException("Resolution explanation is required.");
        }

        var exception = await _context.Exceptions
            .Include(e => e.InternalTransaction)
            .Include(e => e.ExternalTransaction)
            .FirstOrDefaultAsync(e => e.Id == id, cancellationToken);

        if (exception == null)
        {
            throw new KeyNotFoundException("Exception not found.");
        }

        if (currentUserRole == UserRole.Analyst && exception.AssignedTo.HasValue && exception.AssignedTo.Value != currentUserId)
        {
            throw new UnauthorizedAccessException("You are not authorized to act on an exception assigned to another analyst.");
        }

        if (exception.Status == ExceptionStatus.Resolved)
        {
            throw new InvalidOperationException("Exception is already resolved.");
        }

        exception.Status = ExceptionStatus.Resolved;
        exception.ResolutionCategory = request.ResolutionCategory.Trim();
        exception.ResolutionExplanation = request.Explanation.Trim();
        exception.ResolvedBy = currentUserId;
        exception.ResolvedAt = DateTimeOffset.UtcNow;
        exception.UpdatedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync("EXCEPTION_RESOLVED", "EXCEPTION", exception.Id, currentUserId, new { resolutionCategory = exception.ResolutionCategory, explanation = exception.ResolutionExplanation }, null, cancellationToken);

        if (_notificationService != null)
        {
            await _notificationService.BroadcastEventAsync("EXCEPTION_RESOLVED", "Discrepancy Resolved", $"Discrepancy #{exception.Id.ToString()[..8]} was marked {exception.ResolutionCategory}.", new { exceptionId = exception.Id, category = exception.ResolutionCategory }, cancellationToken);
        }

        return await GetExceptionByIdAsync(id, currentUserId, UserRole.Admin, cancellationToken);
    }

    public async Task<TriggerAiAnalysisResponse> TriggerAiAnalysisAsync(Guid id, TriggerAiAnalysisRequest request, Guid currentUserId, string currentUserRole = UserRole.Admin, CancellationToken cancellationToken = default)
    {
        var exception = await _context.Exceptions
            .Include(e => e.InternalTransaction)
            .Include(e => e.ExternalTransaction)
            .FirstOrDefaultAsync(e => e.Id == id, cancellationToken);

        if (exception == null)
        {
            throw new KeyNotFoundException("Exception not found.");
        }

        if (currentUserRole == UserRole.Analyst && exception.AssignedTo.HasValue && exception.AssignedTo.Value != currentUserId)
        {
            throw new UnauthorizedAccessException("You are not authorized to act on an exception assigned to another analyst.");
        }

        var reqType = (request.AnalysisType ?? "ALL").Trim().ToUpper();
        var isDual = reqType == "ALL" || reqType == "DUAL" || reqType == "BOTH";

        await _auditService.LogAsync("AI_ANALYSIS_REQUESTED", "EXCEPTION", exception.Id, currentUserId, new { analysisType = reqType }, null, cancellationToken);

        if (isDual)
        {
            var anomalyTask = _aiClient.AnalyzeAnomalyAsync(exception, exception.InternalTransaction ?? exception.ExternalTransaction, cancellationToken);
            var explainTask = _aiClient.ExplainExceptionAsync(exception, exception.InternalTransaction, exception.ExternalTransaction, cancellationToken);

            await Task.WhenAll(anomalyTask, explainTask);

            var anomalyResult = await anomalyTask;
            var explainResult = await explainTask;

            var anomalyRecord = new AiAnalysis
            {
                Id = anomalyResult.AnalysisId,
                ExceptionId = exception.Id,
                AnalysisType = AiAnalysisType.Anomaly,
                ModelName = anomalyResult.ModelName,
                ModelVersion = "1.2",
                Result = JsonSerializer.Serialize(new
                {
                    summary = anomalyResult.Summary,
                    evidence = anomalyResult.Evidence,
                    recommendation = anomalyResult.Recommendation,
                    advisoryOnly = anomalyResult.AdvisoryOnly
                }),
                Status = anomalyResult.Status,
                CreatedAt = anomalyResult.CreatedAt,
                CompletedAt = DateTimeOffset.UtcNow
            };

            var explainRecord = new AiAnalysis
            {
                Id = explainResult.AnalysisId,
                ExceptionId = exception.Id,
                AnalysisType = AiAnalysisType.Explanation,
                ModelName = explainResult.ModelName,
                ModelVersion = "1.0",
                Result = JsonSerializer.Serialize(new
                {
                    summary = explainResult.Summary,
                    evidence = explainResult.Evidence,
                    recommendation = explainResult.Recommendation,
                    advisoryOnly = explainResult.AdvisoryOnly
                }),
                Status = explainResult.Status,
                CreatedAt = explainResult.CreatedAt,
                CompletedAt = DateTimeOffset.UtcNow
            };

            _context.AiAnalyses.AddRange(anomalyRecord, explainRecord);
            await _context.SaveChangesAsync(cancellationToken);

            await _auditService.LogAsync("AI_ANALYSIS_COMPLETED", "EXCEPTION", exception.Id, currentUserId, new { dual = true, anomalyModel = anomalyRecord.ModelName, explainModel = explainRecord.ModelName }, null, cancellationToken);

            return new TriggerAiAnalysisResponse
            {
                AnalysisId = explainRecord.Id,
                Status = explainRecord.Status
            };
        }
        else
        {
            var analysisType = reqType == "ANOMALY" ? AiAnalysisType.Anomaly : AiAnalysisType.Explanation;
            AiAnalysisDto aiResult;
            if (analysisType == AiAnalysisType.Anomaly)
            {
                aiResult = await _aiClient.AnalyzeAnomalyAsync(exception, exception.InternalTransaction ?? exception.ExternalTransaction, cancellationToken);
            }
            else
            {
                aiResult = await _aiClient.ExplainExceptionAsync(exception, exception.InternalTransaction, exception.ExternalTransaction, cancellationToken);
            }

            var aiAnalysisRecord = new AiAnalysis
            {
                Id = aiResult.AnalysisId,
                ExceptionId = exception.Id,
                AnalysisType = analysisType,
                ModelName = aiResult.ModelName,
                ModelVersion = "1.0",
                Result = JsonSerializer.Serialize(new
                {
                    summary = aiResult.Summary,
                    evidence = aiResult.Evidence,
                    recommendation = aiResult.Recommendation,
                    advisoryOnly = aiResult.AdvisoryOnly
                }),
                Status = aiResult.Status,
                CreatedAt = aiResult.CreatedAt,
                CompletedAt = DateTimeOffset.UtcNow
            };

            _context.AiAnalyses.Add(aiAnalysisRecord);
            await _context.SaveChangesAsync(cancellationToken);

            await _auditService.LogAsync("AI_ANALYSIS_COMPLETED", "EXCEPTION", exception.Id, currentUserId, new { analysisId = aiAnalysisRecord.Id, model = aiAnalysisRecord.ModelName }, null, cancellationToken);

            return new TriggerAiAnalysisResponse
            {
                AnalysisId = aiAnalysisRecord.Id,
                Status = aiAnalysisRecord.Status
            };
        }
    }

    public async Task<List<AiAnalysisDto>> GetExceptionAnalysesAsync(Guid id, bool latestOnly = false, string? type = null, CancellationToken cancellationToken = default)
    {
        var query = _context.AiAnalyses.AsNoTracking()
            .Where(a => a.ExceptionId == id);

        if (!string.IsNullOrWhiteSpace(type))
        {
            var targetType = type.Trim().ToUpper() == "ANOMALY" ? AiAnalysisType.Anomaly : AiAnalysisType.Explanation;
            query = query.Where(a => a.AnalysisType == targetType);
        }

        query = query.OrderByDescending(a => a.CreatedAt);

        List<AiAnalysis> analyses;
        if (latestOnly && string.IsNullOrWhiteSpace(type))
        {
            var all = await query.ToListAsync(cancellationToken);
            analyses = all
                .GroupBy(a => a.AnalysisType)
                .Select(g => g.First())
                .OrderBy(a => a.AnalysisType == AiAnalysisType.Anomaly ? 0 : 1)
                .ToList();
        }
        else if (latestOnly)
        {
            analyses = await query.Take(1).ToListAsync(cancellationToken);
        }
        else
        {
            analyses = await query.ToListAsync(cancellationToken);
        }

        return analyses.Select(a =>
        {
            string? summary = null;
            object? evidence = null;
            string? recommendation = null;
            bool advisory = true;

            if (!string.IsNullOrWhiteSpace(a.Result))
            {
                try
                {
                    var doc = JsonDocument.Parse(a.Result);
                    if (doc.RootElement.TryGetProperty("summary", out var s)) summary = s.GetString();
                    if (doc.RootElement.TryGetProperty("recommendation", out var r)) recommendation = r.GetString();
                    if (doc.RootElement.TryGetProperty("evidence", out var e)) evidence = JsonSerializer.Deserialize<object>(e.GetRawText());
                    if (doc.RootElement.TryGetProperty("advisoryOnly", out var adv)) advisory = adv.GetBoolean();
                }
                catch { }
            }

            return new AiAnalysisDto
            {
                AnalysisId = a.Id,
                Status = a.Status,
                AnalysisType = a.AnalysisType,
                Summary = summary ?? a.Result,
                Evidence = evidence,
                Recommendation = recommendation,
                AdvisoryOnly = advisory,
                ModelName = a.ModelName,
                CreatedAt = a.CreatedAt
            };
        }).ToList();
    }

    private static ExceptionDetailDto MapToDetailDto(DiscrepancyException e)
    {
        return new ExceptionDetailDto
        {
            Id = e.Id,
            ExceptionType = e.ExceptionType,
            Severity = e.Severity,
            Status = e.Status,
            ExpectedAmount = e.ExpectedAmount,
            ActualAmount = e.ActualAmount,
            DiscrepancyAmount = e.DiscrepancyAmount,
            Currency = "INR",
            InternalTransactionId = e.InternalTransactionId,
            ExternalTransactionId = e.ExternalTransactionId,
            AssignedTo = e.Assignee != null ? new UserProfileDto
            {
                Id = e.Assignee.Id,
                FullName = e.Assignee.FullName,
                Email = e.Assignee.Email,
                Role = e.Assignee.Role
            } : null,
            CreatedAt = e.CreatedAt,
            UpdatedAt = e.UpdatedAt,
            ResolvedAt = e.ResolvedAt,
            ResolutionCategory = e.ResolutionCategory,
            ResolutionExplanation = e.ResolutionExplanation,
            ResolvedBy = e.Resolver != null ? new UserProfileDto
            {
                Id = e.Resolver.Id,
                FullName = e.Resolver.FullName,
                Email = e.Resolver.Email,
                Role = e.Resolver.Role
            } : null,
            InternalTransaction = e.InternalTransaction != null ? new TransactionSummaryDto
            {
                Id = e.InternalTransaction.Id,
                TransactionReference = e.InternalTransaction.TransactionReference,
                ExternalReference = e.InternalTransaction.ExternalReference,
                TransactionDate = e.InternalTransaction.TransactionDate,
                Amount = e.InternalTransaction.Amount,
                Currency = e.InternalTransaction.Currency,
                TransactionType = e.InternalTransaction.TransactionType,
                SourceType = e.InternalTransaction.SourceType,
                Status = e.InternalTransaction.Status,
                ImportBatchId = e.InternalTransaction.ImportBatchId
            } : null,
            ExternalTransaction = e.ExternalTransaction != null ? new TransactionSummaryDto
            {
                Id = e.ExternalTransaction.Id,
                TransactionReference = e.ExternalTransaction.TransactionReference,
                ExternalReference = e.ExternalTransaction.ExternalReference,
                TransactionDate = e.ExternalTransaction.TransactionDate,
                Amount = e.ExternalTransaction.Amount,
                Currency = e.ExternalTransaction.Currency,
                TransactionType = e.ExternalTransaction.TransactionType,
                SourceType = e.ExternalTransaction.SourceType,
                Status = e.ExternalTransaction.Status,
                ImportBatchId = e.ExternalTransaction.ImportBatchId
            } : null
        };
    }
}
