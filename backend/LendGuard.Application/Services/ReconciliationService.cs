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

public interface IReconciliationService
{
    Task<StartReconciliationResponse> QueueReconciliationAsync(StartReconciliationRequest request, Guid userId, CancellationToken cancellationToken = default);
    Task ExecuteReconciliationRunAsync(Guid runId, CancellationToken cancellationToken = default);
    Task<PaginatedList<ReconciliationRunSummaryDto>> GetRunsAsync(int page = 1, int pageSize = 20, string? status = null, CancellationToken cancellationToken = default);
    Task<ReconciliationRunDetailDto> GetRunByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<PaginatedList<MatchItemDto>> GetRunMatchesAsync(Guid runId, int page = 1, int pageSize = 20, CancellationToken cancellationToken = default);
    Task<PaginatedList<ExceptionSummaryDto>> GetRunExceptionsAsync(Guid runId, int page = 1, int pageSize = 20, CancellationToken cancellationToken = default);
}

public class ReconciliationService : IReconciliationService
{
    private readonly IApplicationDbContext _context;
    private readonly IAuditService _auditService;

    public ReconciliationService(IApplicationDbContext context, IAuditService auditService)
    {
        _context = context;
        _auditService = auditService;
    }

    public async Task<StartReconciliationResponse> QueueReconciliationAsync(StartReconciliationRequest request, Guid userId, CancellationToken cancellationToken = default)
    {
        if (request.InternalBatchId == request.ExternalBatchId)
        {
            throw new ArgumentException("Internal and external batches must be distinct.");
        }

        var internalBatch = await _context.ImportBatches.AsNoTracking().FirstOrDefaultAsync(b => b.Id == request.InternalBatchId, cancellationToken);
        var externalBatch = await _context.ImportBatches.AsNoTracking().FirstOrDefaultAsync(b => b.Id == request.ExternalBatchId, cancellationToken);

        if (internalBatch == null || externalBatch == null)
        {
            throw new KeyNotFoundException("One or both selected import batches do not exist.");
        }

        if (internalBatch.SourceType != SourceType.Internal || externalBatch.SourceType != SourceType.External)
        {
            throw new ArgumentException("Batches must have opposite source types (one INTERNAL, one EXTERNAL).");
        }

        if ((internalBatch.Status != ImportBatchStatus.Imported && internalBatch.Status != ImportBatchStatus.PartiallyImported) ||
            (externalBatch.Status != ImportBatchStatus.Imported && externalBatch.Status != ImportBatchStatus.PartiallyImported))
        {
            throw new InvalidOperationException("Both batches must be confirmed/imported before reconciliation can be run.");
        }

        // Idempotency: prevent duplicate concurrent or repeated runs for the same batch pair
        var existingRun = await _context.ReconciliationRuns.FirstOrDefaultAsync(r =>
            r.InternalBatchId == request.InternalBatchId &&
            r.ExternalBatchId == request.ExternalBatchId &&
            (r.Status == ReconciliationRunStatus.Queued || r.Status == ReconciliationRunStatus.Processing || r.Status == ReconciliationRunStatus.Completed),
            cancellationToken);

        if (existingRun != null)
        {
            if (existingRun.Status == ReconciliationRunStatus.Completed)
            {
                throw new InvalidOperationException("A reconciliation run has already been completed for this batch pair. Duplicate reconciliation is prohibited.");
            }
            throw new InvalidOperationException("A reconciliation run is already active for this batch pair.");
        }

        double tolerance = request.DateToleranceDays ?? 0.0;
        var run = new ReconciliationRun
        {
            Id = Guid.NewGuid(),
            InternalBatchId = request.InternalBatchId,
            ExternalBatchId = request.ExternalBatchId,
            Status = ReconciliationRunStatus.Queued,
            StartedBy = userId,
            RuleVersion = $"recon-v1;tolerance={tolerance:0.#}d",
            StartedAt = DateTimeOffset.UtcNow
        };

        var job = new BackgroundJob
        {
            Id = Guid.NewGuid(),
            JobType = BackgroundJobType.Reconciliation,
            Payload = JsonSerializer.Serialize(new { runId = run.Id }),
            Status = BackgroundJobStatus.Pending,
            AvailableAt = DateTimeOffset.UtcNow,
            CreatedAt = DateTimeOffset.UtcNow
        };

        _context.ReconciliationRuns.Add(run);
        _context.BackgroundJobs.Add(job);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync("RECONCILIATION_STARTED", "RECONCILIATION_RUN", run.Id, userId, new { internalBatchId = run.InternalBatchId, externalBatchId = run.ExternalBatchId, ruleVersion = run.RuleVersion }, null, cancellationToken);

        // Process reconciliation
        _ = Task.Run(async () =>
        {
            try
            {
                await ExecuteReconciliationRunAsync(run.Id, CancellationToken.None);
            }
            catch
            {
                // Background worker also polls for queued/pending jobs
            }
        });

        return new StartReconciliationResponse
        {
            RunId = run.Id,
            Status = run.Status,
            Message = "Reconciliation has been queued."
        };
    }

    public async Task ExecuteReconciliationRunAsync(Guid runId, CancellationToken cancellationToken = default)
    {
        var run = await _context.ReconciliationRuns
            .Include(r => r.InternalBatch)
            .Include(r => r.ExternalBatch)
            .FirstOrDefaultAsync(r => r.Id == runId, cancellationToken);

        if (run == null || run.Status == ReconciliationRunStatus.Completed)
        {
            return;
        }

        run.Status = ReconciliationRunStatus.Processing;
        await _context.SaveChangesAsync(cancellationToken);

        try
        {
            // Load all transactions for internal and external batches
            var internalTxns = await _context.Transactions
                .Where(t => t.ImportBatchId == run.InternalBatchId)
                .OrderBy(t => t.SourceRowNumber)
                .ToListAsync(cancellationToken);

            var externalTxns = await _context.Transactions
                .Where(t => t.ImportBatchId == run.ExternalBatchId)
                .OrderBy(t => t.SourceRowNumber)
                .ToListAsync(cancellationToken);

            run.TotalInternal = internalTxns.Count;
            run.TotalExternal = externalTxns.Count;

            double dateToleranceDays = 0.0; // Baseline default is zero-day (same calendar date)
            if (!string.IsNullOrEmpty(run.RuleVersion) && run.RuleVersion.Contains("tolerance="))
            {
                var match = System.Text.RegularExpressions.Regex.Match(run.RuleVersion, @"tolerance=(\d+(?:\.\d+)?)");
                if (match.Success && double.TryParse(match.Groups[1].Value, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var parsed))
                {
                    dateToleranceDays = parsed;
                }
            }

            var matches = new List<ReconciliationMatch>();
            var exceptions = new List<DiscrepancyException>();

            var matchedInternalIds = new HashSet<Guid>();
            var matchedExternalIds = new HashSet<Guid>();

            // Helper to get all non-empty match keys for a transaction
            static List<string> GetMatchKeys(Transaction t)
            {
                var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                if (!string.IsNullOrWhiteSpace(t.TransactionReference))
                    keys.Add(t.TransactionReference.Trim().ToUpperInvariant());
                if (!string.IsNullOrWhiteSpace(t.ExternalReference))
                    keys.Add(t.ExternalReference.Trim().ToUpperInvariant());
                return keys.ToList();
            }

            // Map all external transactions by (Key, Currency)
            var extByKey = new Dictionary<(string Ref, string Curr), List<Transaction>>();
            foreach (var ext in externalTxns)
            {
                var curr = ext.Currency.Trim().ToUpperInvariant();
                foreach (var k in GetMatchKeys(ext))
                {
                    var dictKey = (Ref: k, Curr: curr);
                    if (!extByKey.TryGetValue(dictKey, out var list))
                    {
                        list = new List<Transaction>();
                        extByKey[dictKey] = list;
                    }
                    if (!list.Contains(ext))
                    {
                        list.Add(ext);
                    }
                }
            }

            var intByRef = internalTxns
                .GroupBy(i => (Ref: i.TransactionReference.Trim().ToUpperInvariant(), Curr: i.Currency.Trim().ToUpperInvariant()))
                .ToDictionary(g => g.Key, g => g.ToList());

            // 1. Process Internal Transactions
            foreach (var intGroup in intByRef)
            {
                var currentIntTxns = intGroup.Value;

                // Check internal duplicates within same batch (RC-06)
                if (currentIntTxns.Count > 1)
                {
                    foreach (var dup in currentIntTxns)
                    {
                        dup.Status = TransactionStatus.Exception;
                        exceptions.Add(new DiscrepancyException
                        {
                            Id = Guid.NewGuid(),
                            ReconciliationRunId = run.Id,
                            InternalTransactionId = dup.Id,
                            ExceptionType = ExceptionType.Duplicate,
                            Severity = ExceptionSeverity.High,
                            Status = ExceptionStatus.Open,
                            ExpectedAmount = dup.Amount,
                            DiscrepancyAmount = dup.Amount,
                            CreatedAt = DateTimeOffset.UtcNow,
                            UpdatedAt = DateTimeOffset.UtcNow
                        });
                        matchedInternalIds.Add(dup.Id);
                    }
                    continue;
                }

                var intTxn = currentIntTxns.First();
                var curr = intTxn.Currency.Trim().ToUpperInvariant();

                List<Transaction>? candidates = null;
                foreach (var k in GetMatchKeys(intTxn))
                {
                    if (extByKey.TryGetValue((Ref: k, Curr: curr), out var list) && list.Count > 0)
                    {
                        // Ensure an external transaction cannot be consumed multiple times
                        candidates = list.Where(c => !matchedExternalIds.Contains(c.Id)).Distinct().ToList();
                        if (candidates.Count > 0)
                            break;
                    }
                }

                if (candidates == null || candidates.Count == 0)
                {
                    // No candidate in external batch -> MISSING_SETTLEMENT (RC-04)
                    intTxn.Status = TransactionStatus.Exception;
                    exceptions.Add(new DiscrepancyException
                    {
                        Id = Guid.NewGuid(),
                        ReconciliationRunId = run.Id,
                        InternalTransactionId = intTxn.Id,
                        ExceptionType = ExceptionType.MissingSettlement,
                        Severity = ExceptionSeverity.High,
                        Status = ExceptionStatus.Open,
                        ExpectedAmount = intTxn.Amount,
                        DiscrepancyAmount = intTxn.Amount,
                        CreatedAt = DateTimeOffset.UtcNow,
                        UpdatedAt = DateTimeOffset.UtcNow
                    });
                    matchedInternalIds.Add(intTxn.Id);
                    continue;
                }

                // If single external candidate exists
                if (candidates.Count == 1)
                {
                    var extTxn = candidates.First();
                    var dateDiff = Math.Abs((intTxn.TransactionDate.Date - extTxn.TransactionDate.Date).TotalDays);

                    if (intTxn.Amount == extTxn.Amount)
                    {
                        if (dateDiff <= dateToleranceDays)
                        {
                            // RC-01 & RC-02: EXACT MATCH (within configured date tolerance window)
                            intTxn.Status = TransactionStatus.Matched;
                            extTxn.Status = TransactionStatus.Matched;
                            matchedInternalIds.Add(intTxn.Id);
                            matchedExternalIds.Add(extTxn.Id);

                            var match = new ReconciliationMatch
                            {
                                Id = Guid.NewGuid(),
                                ReconciliationRunId = run.Id,
                                MatchType = Domain.MatchType.Exact,
                                Confidence = 100.00m,
                                Evidence = JsonSerializer.Serialize(new
                                {
                                    referenceMatch = true,
                                    amountMatch = true,
                                    currencyMatch = true,
                                    internalAmount = intTxn.Amount,
                                    externalAmount = extTxn.Amount,
                                    dateDifferenceDays = (int)dateDiff,
                                    dateToleranceDays = dateToleranceDays
                                }),
                                CreatedAt = DateTimeOffset.UtcNow,
                                MatchItems = new List<ReconciliationMatchItem>
                                {
                                    new() { Id = Guid.NewGuid(), TransactionId = intTxn.Id, Side = SourceType.Internal, AmountApplied = intTxn.Amount },
                                    new() { Id = Guid.NewGuid(), TransactionId = extTxn.Id, Side = SourceType.External, AmountApplied = extTxn.Amount }
                                }
                            };
                            matches.Add(match);
                        }
                        else
                        {
                            // Amount matches but outside configured date tolerance window (RC-08 Ambiguous)
                            intTxn.Status = TransactionStatus.Exception;
                            extTxn.Status = TransactionStatus.Exception;
                            matchedInternalIds.Add(intTxn.Id);
                            matchedExternalIds.Add(extTxn.Id);

                            exceptions.Add(new DiscrepancyException
                            {
                                Id = Guid.NewGuid(),
                                ReconciliationRunId = run.Id,
                                InternalTransactionId = intTxn.Id,
                                ExternalTransactionId = extTxn.Id,
                                ExceptionType = ExceptionType.AmbiguousMatch,
                                Severity = ExceptionSeverity.Medium,
                                Status = ExceptionStatus.Open,
                                ExpectedAmount = intTxn.Amount,
                                ActualAmount = extTxn.Amount,
                                DiscrepancyAmount = 0.00m,
                                CreatedAt = DateTimeOffset.UtcNow,
                                UpdatedAt = DateTimeOffset.UtcNow
                            });
                        }
                    }
                    else
                    {
                        // RC-03: AMOUNT_MISMATCH
                        intTxn.Status = TransactionStatus.Exception;
                        extTxn.Status = TransactionStatus.Exception;
                        matchedInternalIds.Add(intTxn.Id);
                        matchedExternalIds.Add(extTxn.Id);

                        var diff = Math.Abs(intTxn.Amount - extTxn.Amount);
                        exceptions.Add(new DiscrepancyException
                        {
                            Id = Guid.NewGuid(),
                            ReconciliationRunId = run.Id,
                            InternalTransactionId = intTxn.Id,
                            ExternalTransactionId = extTxn.Id,
                            ExceptionType = ExceptionType.AmountMismatch,
                            Severity = ExceptionSeverity.High,
                            Status = ExceptionStatus.Open,
                            ExpectedAmount = intTxn.Amount,
                            ActualAmount = extTxn.Amount,
                            DiscrepancyAmount = diff,
                            CreatedAt = DateTimeOffset.UtcNow,
                            UpdatedAt = DateTimeOffset.UtcNow
                        });
                    }
                }
                else
                {
                    // Multiple external candidates for this reference (RC-07 / RC-08)
                    var extSum = candidates.Sum(c => c.Amount);
                    if (candidates.Count > 1 && candidates.All(c => c.Amount == intTxn.Amount))
                    {
                        // Multiple external claiming same full amount -> DUPLICATE
                        intTxn.Status = TransactionStatus.Exception;
                        matchedInternalIds.Add(intTxn.Id);
                        foreach (var c in candidates)
                        {
                            c.Status = TransactionStatus.Exception;
                            matchedExternalIds.Add(c.Id);
                            exceptions.Add(new DiscrepancyException
                            {
                                Id = Guid.NewGuid(),
                                ReconciliationRunId = run.Id,
                                InternalTransactionId = intTxn.Id,
                                ExternalTransactionId = c.Id,
                                ExceptionType = ExceptionType.Duplicate,
                                Severity = ExceptionSeverity.High,
                                Status = ExceptionStatus.Open,
                                ExpectedAmount = intTxn.Amount,
                                ActualAmount = c.Amount,
                                DiscrepancyAmount = c.Amount,
                                CreatedAt = DateTimeOffset.UtcNow,
                                UpdatedAt = DateTimeOffset.UtcNow
                            });
                        }
                    }
                    else if (extSum == intTxn.Amount)
                    {
                        // RC-07: AGGREGATE MATCH (sum equals expected)
                        intTxn.Status = TransactionStatus.Matched;
                        matchedInternalIds.Add(intTxn.Id);

                        var matchItems = new List<ReconciliationMatchItem>
                        {
                            new() { Id = Guid.NewGuid(), TransactionId = intTxn.Id, Side = SourceType.Internal, AmountApplied = intTxn.Amount }
                        };

                        foreach (var c in candidates)
                        {
                            c.Status = TransactionStatus.Matched;
                            matchedExternalIds.Add(c.Id);
                            matchItems.Add(new() { Id = Guid.NewGuid(), TransactionId = c.Id, Side = SourceType.External, AmountApplied = c.Amount });
                        }

                        matches.Add(new ReconciliationMatch
                        {
                            Id = Guid.NewGuid(),
                            ReconciliationRunId = run.Id,
                            MatchType = Domain.MatchType.Aggregate,
                            Confidence = 95.00m,
                            Evidence = JsonSerializer.Serialize(new
                            {
                                referenceMatch = true,
                                aggregateMatch = true,
                                candidateCount = candidates.Count,
                                totalAmount = extSum
                            }),
                            CreatedAt = DateTimeOffset.UtcNow,
                            MatchItems = matchItems
                        });
                    }
                    else if (extSum < intTxn.Amount)
                    {
                        // RC-07: PARTIAL_SETTLEMENT
                        intTxn.Status = TransactionStatus.Exception;
                        matchedInternalIds.Add(intTxn.Id);
                        foreach (var c in candidates)
                        {
                            c.Status = TransactionStatus.Exception;
                            matchedExternalIds.Add(c.Id);
                        }

                        exceptions.Add(new DiscrepancyException
                        {
                            Id = Guid.NewGuid(),
                            ReconciliationRunId = run.Id,
                            InternalTransactionId = intTxn.Id,
                            ExternalTransactionId = candidates.First().Id,
                            ExceptionType = ExceptionType.PartialSettlement,
                            Severity = ExceptionSeverity.Medium,
                            Status = ExceptionStatus.Open,
                            ExpectedAmount = intTxn.Amount,
                            ActualAmount = extSum,
                            DiscrepancyAmount = intTxn.Amount - extSum,
                            CreatedAt = DateTimeOffset.UtcNow,
                            UpdatedAt = DateTimeOffset.UtcNow
                        });
                    }
                    else
                    {
                        // RC-08: AMBIGUOUS_MATCH
                        intTxn.Status = TransactionStatus.Exception;
                        matchedInternalIds.Add(intTxn.Id);
                        foreach (var c in candidates)
                        {
                            c.Status = TransactionStatus.Exception;
                            matchedExternalIds.Add(c.Id);
                        }

                        exceptions.Add(new DiscrepancyException
                        {
                            Id = Guid.NewGuid(),
                            ReconciliationRunId = run.Id,
                            InternalTransactionId = intTxn.Id,
                            ExceptionType = ExceptionType.AmbiguousMatch,
                            Severity = ExceptionSeverity.High,
                            Status = ExceptionStatus.Open,
                            ExpectedAmount = intTxn.Amount,
                            ActualAmount = extSum,
                            DiscrepancyAmount = Math.Abs(intTxn.Amount - extSum),
                            CreatedAt = DateTimeOffset.UtcNow,
                            UpdatedAt = DateTimeOffset.UtcNow
                        });
                    }
                }
            }

            // 2. Identify UNMATCHED_EXTERNAL (RC-05) for external transactions not yet matched
            foreach (var extTxn in externalTxns)
            {
                if (!matchedExternalIds.Contains(extTxn.Id))
                {
                    extTxn.Status = TransactionStatus.Exception;
                    exceptions.Add(new DiscrepancyException
                    {
                        Id = Guid.NewGuid(),
                        ReconciliationRunId = run.Id,
                        ExternalTransactionId = extTxn.Id,
                        ExceptionType = ExceptionType.UnmatchedExternal,
                        Severity = ExceptionSeverity.Medium,
                        Status = ExceptionStatus.Open,
                        ActualAmount = extTxn.Amount,
                        DiscrepancyAmount = extTxn.Amount,
                        CreatedAt = DateTimeOffset.UtcNow,
                        UpdatedAt = DateTimeOffset.UtcNow
                    });
                }
            }

            // Persist matches and exceptions atomically
            if (matches.Any())
            {
                _context.ReconciliationMatches.AddRange(matches);
            }
            if (exceptions.Any())
            {
                _context.Exceptions.AddRange(exceptions);
            }

            run.MatchedCount = matches.Count;
            run.ExceptionCount = exceptions.Count;
            run.Status = ReconciliationRunStatus.Completed;
            run.CompletedAt = DateTimeOffset.UtcNow;

            await _context.SaveChangesAsync(cancellationToken);

            await _auditService.LogAsync("RECONCILIATION_COMPLETED", "RECONCILIATION_RUN", run.Id, run.StartedBy, new { matchedCount = run.MatchedCount, exceptionCount = run.ExceptionCount, durationSeconds = (run.CompletedAt.Value - run.StartedAt).TotalSeconds }, null, cancellationToken);
        }
        catch (Exception ex)
        {
            run.Status = ReconciliationRunStatus.Failed;
            run.FailureCode = "EXECUTION_ERROR";
            run.FailureMessage = "An error occurred during reconciliation execution.";
            await _context.SaveChangesAsync(cancellationToken);

            await _auditService.LogAsync("RECONCILIATION_FAILED", "RECONCILIATION_RUN", run.Id, run.StartedBy, new { error = ex.Message }, null, cancellationToken);
        }
    }

    public async Task<PaginatedList<ReconciliationRunSummaryDto>> GetRunsAsync(int page = 1, int pageSize = 20, string? status = null, CancellationToken cancellationToken = default)
    {
        var query = _context.ReconciliationRuns.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(r => r.Status == status.Trim().ToUpper());
        }

        var total = await query.CountAsync(cancellationToken);
        var items = await query.OrderByDescending(r => r.StartedAt)
                               .Skip((page - 1) * pageSize)
                               .Take(pageSize)
                               .Select(r => new ReconciliationRunSummaryDto
                               {
                                   Id = r.Id,
                                   Status = r.Status,
                                   InternalBatchId = r.InternalBatchId,
                                   ExternalBatchId = r.ExternalBatchId,
                                   MatchedCount = r.MatchedCount,
                                   ExceptionCount = r.ExceptionCount,
                                   StartedAt = r.StartedAt,
                                   CompletedAt = r.CompletedAt
                               })
                               .ToListAsync(cancellationToken);

        return new PaginatedList<ReconciliationRunSummaryDto>(items, total, page, pageSize);
    }

    public async Task<ReconciliationRunDetailDto> GetRunByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var run = await _context.ReconciliationRuns.AsNoTracking()
            .Include(r => r.InternalBatch)
            .Include(r => r.ExternalBatch)
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

        if (run == null)
        {
            throw new KeyNotFoundException("Reconciliation run not found.");
        }

        return new ReconciliationRunDetailDto
        {
            Id = run.Id,
            Status = run.Status,
            InternalBatchId = run.InternalBatchId,
            ExternalBatchId = run.ExternalBatchId,
            InternalBatchReference = run.InternalBatch?.BatchReference,
            ExternalBatchReference = run.ExternalBatch?.BatchReference,
            TotalInternal = run.TotalInternal,
            TotalExternal = run.TotalExternal,
            MatchedCount = run.MatchedCount,
            ExceptionCount = run.ExceptionCount,
            RuleVersion = run.RuleVersion,
            StartedAt = run.StartedAt,
            CompletedAt = run.CompletedAt,
            FailureCode = run.FailureCode,
            FailureMessage = run.FailureMessage
        };
    }

    public async Task<PaginatedList<MatchItemDto>> GetRunMatchesAsync(Guid runId, int page = 1, int pageSize = 20, CancellationToken cancellationToken = default)
    {
        var query = _context.ReconciliationMatches.AsNoTracking()
            .Where(m => m.ReconciliationRunId == runId)
            .Include(m => m.MatchItems)
                .ThenInclude(mi => mi.Transaction);

        var total = await query.CountAsync(cancellationToken);
        var matches = await query.OrderBy(m => m.CreatedAt)
                                 .Skip((page - 1) * pageSize)
                                 .Take(pageSize)
                                 .ToListAsync(cancellationToken);

        var items = matches.Select(m => new MatchItemDto
        {
            Id = m.Id,
            MatchType = m.MatchType,
            Confidence = m.Confidence,
            Evidence = JsonSerializer.Deserialize<object>(m.Evidence),
            Members = m.MatchItems.Select(mi => new MatchMemberDto
            {
                TransactionId = mi.TransactionId,
                Side = mi.Side,
                AmountApplied = mi.AmountApplied,
                TransactionReference = mi.Transaction?.TransactionReference
            }).ToList()
        }).ToList();

        return new PaginatedList<MatchItemDto>(items, total, page, pageSize);
    }

    public async Task<PaginatedList<ExceptionSummaryDto>> GetRunExceptionsAsync(Guid runId, int page = 1, int pageSize = 20, CancellationToken cancellationToken = default)
    {
        var query = _context.Exceptions.AsNoTracking()
            .Where(e => e.ReconciliationRunId == runId)
            .Include(e => e.Assignee);

        var total = await query.CountAsync(cancellationToken);
        var exceptions = await query.OrderByDescending(e => e.CreatedAt)
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

        return new PaginatedList<ExceptionSummaryDto>(exceptions, total, page, pageSize);
    }
}
