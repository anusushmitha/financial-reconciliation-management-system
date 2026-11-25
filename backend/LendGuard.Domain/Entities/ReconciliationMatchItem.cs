using System;

namespace LendGuard.Domain.Entities;

public class ReconciliationMatchItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ReconciliationMatchId { get; set; }
    public Guid TransactionId { get; set; }
    public string Side { get; set; } = Domain.SourceType.Internal; // INTERNAL or EXTERNAL
    public decimal AmountApplied { get; set; }

    public ReconciliationMatch? ReconciliationMatch { get; set; }
    public Transaction? Transaction { get; set; }
}
