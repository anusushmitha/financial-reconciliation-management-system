using System;
using System.Collections.Generic;

namespace LendGuard.Domain.Entities;

public class ReconciliationMatch
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ReconciliationRunId { get; set; }
    public string MatchType { get; set; } = Domain.MatchType.Exact;
    public decimal? Confidence { get; set; }
    public string Evidence { get; set; } = "{}";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ReconciliationRun? ReconciliationRun { get; set; }
    public ICollection<ReconciliationMatchItem> MatchItems { get; set; } = new List<ReconciliationMatchItem>();
}
