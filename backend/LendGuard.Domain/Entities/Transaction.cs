using System;
using System.Collections.Generic;

namespace LendGuard.Domain.Entities;

public class Transaction
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ImportBatchId { get; set; }
    public int SourceRowNumber { get; set; }
    public string TransactionReference { get; set; } = string.Empty;
    public string? ExternalReference { get; set; }
    public DateTimeOffset TransactionDate { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "INR";
    public string? TransactionType { get; set; }
    public string SourceType { get; set; } = Domain.SourceType.Internal;
    public string Status { get; set; } = TransactionStatus.Pending;
    public string RawData { get; set; } = "{}";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ImportBatch? ImportBatch { get; set; }
    public ICollection<ReconciliationMatchItem> MatchItems { get; set; } = new List<ReconciliationMatchItem>();
    public ICollection<DiscrepancyException> InternalExceptions { get; set; } = new List<DiscrepancyException>();
    public ICollection<DiscrepancyException> ExternalExceptions { get; set; } = new List<DiscrepancyException>();
}
