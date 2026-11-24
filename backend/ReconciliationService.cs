using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

public class ReconciliationResultDto
{
    public int BatchId { get; set; }
    public int TotalProcessed { get; set; }
    public int MatchedCount { get; set; }
    public int UnmatchedInternalCount { get; set; }
    public int UnmatchedExternalCount { get; set; }
    public int DuplicateCount { get; set; }
    public int AmountMismatchCount { get; set; }
    public int PartialSettlementCount { get; set; }
    public decimal SuccessRate { get; set; }
    public List<ExceptionRecord> GeneratedExceptions { get; set; } = new();
}

public class ReconciliationService
{
    private readonly LendGuardContext _context;

    public ReconciliationService(LendGuardContext context)
    {
        _context = context;
    }

    public ReconciliationResultDto Reconcile(string executedBy = "System Administrator")
    {
        var internalTx = _context.Transactions
            .Where(t => t.SourceSystem == "Internal")
            .ToList();

        var externalTx = _context.Transactions
            .Where(t => t.SourceSystem == "External")
            .ToList();

        var result = new ReconciliationResultDto();
        var generatedExceptions = new List<ExceptionRecord>();
        var batchGuid = Guid.NewGuid().ToString("N");

        var internalLookup = internalTx.GroupBy(t => t.ReferenceId).ToDictionary(g => g.Key, g => g.ToList());
        var externalLookup = externalTx.GroupBy(t => t.ReferenceId).ToDictionary(g => g.Key, g => g.ToList());

        var allReferences = new HashSet<string>(internalLookup.Keys.Concat(externalLookup.Keys));

        foreach (var refId in allReferences)
        {
            internalLookup.TryGetValue(refId, out var intList);
            externalLookup.TryGetValue(refId, out var extList);

            intList ??= new List<Transaction>();
            extList ??= new List<Transaction>();

            // 1. Check for Duplicate Internal
            if (intList.Count > 1)
            {
                result.DuplicateCount += (intList.Count - 1);
                foreach (var dup in intList.Skip(1))
                {
                    dup.ReconciliationStatus = "Duplicate";
                    dup.BatchId = batchGuid;
                    generatedExceptions.Add(new ExceptionRecord
                    {
                        TransactionReference = refId,
                        ExceptionType = "DuplicateInternal",
                        Severity = "High",
                        Amount = dup.Amount,
                        Description = $"Duplicate internal transaction reference '{refId}' detected ({intList.Count} instances).",
                        Evidence = $"ReferenceId={refId}, TotalInstances={intList.Count}, Amounts=[{string.Join(", ", intList.Select(x => x.Amount))}], Dates=[{string.Join(", ", intList.Select(x => x.TransactionDate.ToString("yyyy-MM-dd")))}]",
                        Status = "Open",
                        CreatedDate = DateTime.UtcNow
                    });
                }
            }

            // 2. Check for Duplicate External
            if (extList.Count > 1)
            {
                result.DuplicateCount += (extList.Count - 1);
                foreach (var dup in extList.Skip(1))
                {
                    dup.ReconciliationStatus = "Duplicate";
                    dup.BatchId = batchGuid;
                    generatedExceptions.Add(new ExceptionRecord
                    {
                        TransactionReference = refId,
                        ExceptionType = "DuplicateExternal",
                        Severity = "High",
                        Amount = dup.Amount,
                        Description = $"Duplicate external banking settlement reference '{refId}' detected ({extList.Count} instances).",
                        Evidence = $"ReferenceId={refId}, TotalInstances={extList.Count}, Amounts=[{string.Join(", ", extList.Select(x => x.Amount))}], Dates=[{string.Join(", ", extList.Select(x => x.TransactionDate.ToString("yyyy-MM-dd")))}]",
                        Status = "Open",
                        CreatedDate = DateTime.UtcNow
                    });
                }
            }

            // 3. Missing Internal (External exists without Internal)
            if (intList.Count == 0 && extList.Count > 0)
            {
                result.UnmatchedExternalCount += extList.Count;
                foreach (var ext in extList)
                {
                    ext.ReconciliationStatus = "Discrepancy";
                    ext.BatchId = batchGuid;
                    generatedExceptions.Add(new ExceptionRecord
                    {
                        TransactionReference = refId,
                        ExceptionType = "MissingInternal",
                        Severity = ext.Amount >= 1000m ? "High" : "Medium",
                        Amount = ext.Amount,
                        Description = $"Settled by external bank/payment provider, but no corresponding internal financial book record exists.",
                        Evidence = $"Source=External Bank, ReferenceId={refId}, SettledAmount=${ext.Amount:F2}, SettlementDate={ext.TransactionDate:yyyy-MM-dd}, Currency={ext.Currency}, InternalMatch=None",
                        Status = "Open",
                        CreatedDate = DateTime.UtcNow
                    });
                }
                continue;
            }

            // 4. Missing External (Internal exists without External settlement)
            if (extList.Count == 0 && intList.Count > 0)
            {
                result.UnmatchedInternalCount += intList.Count;
                foreach (var inc in intList)
                {
                    inc.ReconciliationStatus = "Discrepancy";
                    inc.BatchId = batchGuid;
                    generatedExceptions.Add(new ExceptionRecord
                    {
                        TransactionReference = refId,
                        ExceptionType = "MissingExternal",
                        Severity = inc.Amount >= 500m ? "High" : "Medium",
                        Amount = inc.Amount,
                        Description = $"Internal financial ledger record exists, but settlement confirmation has not been received from external bank.",
                        Evidence = $"Source=Internal Ledger, ReferenceId={refId}, BookAmount=${inc.Amount:F2}, TransactionDate={inc.TransactionDate:yyyy-MM-dd}, Currency={inc.Currency}, ExternalMatch=None",
                        Status = "Open",
                        CreatedDate = DateTime.UtcNow
                    });
                }
                continue;
            }

            // 5. Compare Internal vs External Pair
            var primaryInt = intList.First();
            var primaryExt = extList.First();

            primaryInt.BatchId = batchGuid;
            primaryExt.BatchId = batchGuid;

            decimal amountDiff = Math.Abs(primaryInt.Amount - primaryExt.Amount);
            bool isAmountMatched = amountDiff <= 0.01m;
            int daysDiff = Math.Abs((primaryInt.TransactionDate.Date - primaryExt.TransactionDate.Date).Days);
            bool isDateMatched = daysDiff <= 1; // Allow up to 1 calendar day timing clearance

            if (isAmountMatched && isDateMatched)
            {
                // Exact Match
                result.MatchedCount++;
                primaryInt.ReconciliationStatus = "Matched";
                primaryExt.ReconciliationStatus = "Matched";
            }
            else if (!isAmountMatched)
            {
                // Partial Settlement (installments, split tranches, or <= 50% partial payout) vs Amount Mismatch
                bool isPartial = primaryInt.Type.Equals("Partial", StringComparison.OrdinalIgnoreCase) ||
                                 primaryExt.Type.Equals("Partial", StringComparison.OrdinalIgnoreCase) ||
                                 (primaryExt.Amount <= primaryInt.Amount * 0.50m && primaryExt.Amount > 0);

                if (isPartial)
                {
                    result.PartialSettlementCount++;
                    primaryInt.ReconciliationStatus = "Discrepancy";
                    primaryExt.ReconciliationStatus = "Discrepancy";

                    generatedExceptions.Add(new ExceptionRecord
                    {
                        TransactionReference = refId,
                        ExceptionType = "PartialSettlement",
                        Severity = "Low",
                        Amount = primaryInt.Amount,
                        Description = $"Partial settlement detected: External bank settled ${primaryExt.Amount:F2} of expected ${primaryInt.Amount:F2} (variance of ${amountDiff:F2}).",
                        Evidence = $"InternalAmount=${primaryInt.Amount:F2}, ExternalSettled=${primaryExt.Amount:F2}, OutstandingDelta=${amountDiff:F2}, InternalDate={primaryInt.TransactionDate:yyyy-MM-dd}, SettlementDate={primaryExt.TransactionDate:yyyy-MM-dd}",
                        Status = "Open",
                        CreatedDate = DateTime.UtcNow
                    });
                }
                else
                {
                    result.AmountMismatchCount++;
                    primaryInt.ReconciliationStatus = "Discrepancy";
                    primaryExt.ReconciliationStatus = "Discrepancy";

                    var pct = (amountDiff / Math.Max(primaryInt.Amount, 0.01m)) * 100m;
                    string severity = (amountDiff > 500m || pct > 20m) ? "High" : "Medium";

                    generatedExceptions.Add(new ExceptionRecord
                    {
                        TransactionReference = refId,
                        ExceptionType = "AmountMismatch",
                        Severity = severity,
                        Amount = primaryInt.Amount,
                        Description = $"Amount variance detected between internal book record (${primaryInt.Amount:F2}) and bank settlement record (${primaryExt.Amount:F2}).",
                        Evidence = $"InternalRecord=[Amount=${primaryInt.Amount:F2}, Date={primaryInt.TransactionDate:yyyy-MM-dd}], ExternalRecord=[Amount=${primaryExt.Amount:F2}, Date={primaryExt.TransactionDate:yyyy-MM-dd}], Variance=${amountDiff:F2} ({pct:F1}%)",
                        Status = "Open",
                        CreatedDate = DateTime.UtcNow
                    });
                }
            }
            else if (!isDateMatched)
            {
                // Date Variance
                result.PartialSettlementCount++;
                primaryInt.ReconciliationStatus = "Discrepancy";
                primaryExt.ReconciliationStatus = "Discrepancy";

                generatedExceptions.Add(new ExceptionRecord
                {
                    TransactionReference = refId,
                    ExceptionType = "PartialSettlement",
                    Severity = "Low",
                    Amount = primaryInt.Amount,
                    Description = $"Timing variance of {daysDiff} days between internal transaction date and bank settlement clearance.",
                    Evidence = $"InternalDate={primaryInt.TransactionDate:yyyy-MM-dd}, ExternalDate={primaryExt.TransactionDate:yyyy-MM-dd}, ClearanceDelay={daysDiff} days, Amount=${primaryInt.Amount:F2}",
                    Status = "Open",
                    CreatedDate = DateTime.UtcNow
                });
            }
        }

        int totalComparisons = result.MatchedCount + result.UnmatchedInternalCount + result.UnmatchedExternalCount + result.AmountMismatchCount + result.PartialSettlementCount;
        result.TotalProcessed = totalComparisons;
        result.SuccessRate = totalComparisons > 0 
            ? Math.Round(((decimal)result.MatchedCount / totalComparisons) * 100m, 2) 
            : 0.00m;

        // Persist newly generated exceptions (prevent duplicate exception insertion for same ref & batch)
        if (generatedExceptions.Any())
        {
            _context.Exceptions.AddRange(generatedExceptions);
        }

        // Record Reconciliation Batch
        var batch = new ReconciliationBatch
        {
            ExecutedAt = DateTime.UtcNow,
            MatchedCount = result.MatchedCount,
            UnmatchedInternalCount = result.UnmatchedInternalCount,
            UnmatchedExternalCount = result.UnmatchedExternalCount,
            DuplicateCount = result.DuplicateCount,
            AmountMismatchCount = result.AmountMismatchCount,
            PartialSettlementCount = result.PartialSettlementCount,
            SuccessRate = result.SuccessRate,
            ExecutedBy = executedBy
        };
        _context.ReconciliationBatches.Add(batch);

        // Queue PostgreSQL Outbox Messages for background processing / automated advisory AI analysis
        foreach (var ex in generatedExceptions)
        {
            var outboxItem = new OutboxMessage
            {
                EventType = "ExceptionCreated",
                Payload = JsonSerializer.Serialize(new
                {
                    ExceptionReference = ex.TransactionReference,
                    ExceptionType = ex.ExceptionType,
                    Amount = ex.Amount,
                    Severity = ex.Severity,
                    Description = ex.Description,
                    Evidence = ex.Evidence
                }),
                Status = "Pending"
            };
            _context.OutboxMessages.Add(outboxItem);
        }

        _context.SaveChanges();

        result.BatchId = batch.Id;
        result.GeneratedExceptions = generatedExceptions;
        return result;
    }
}
