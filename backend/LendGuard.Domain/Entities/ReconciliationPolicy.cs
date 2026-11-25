using System;

namespace LendGuard.Domain.Entities;

public class ReconciliationPolicy
{
    public Guid Id { get; set; }
    public string ProfileId { get; set; } = "strict";
    public decimal AmountTolerancePercent { get; set; } = 0.00m;
    public decimal FixedRupeeTolerance { get; set; } = 0.00m;
    public int DateSlippageDays { get; set; } = 0;
    public bool FuzzyReferenceMatching { get; set; } = true;
    public int FuzzyThreshold { get; set; } = 85;
    public int AutoReconConfidence { get; set; } = 95;
    public decimal IsolationForestOutlierThreshold { get; set; } = 0.75m;
    public bool MultiCurrencyHandling { get; set; } = true;
    public Guid? UpdatedBy { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
