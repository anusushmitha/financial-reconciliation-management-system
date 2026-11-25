using System;
using System.Collections.Generic;

namespace LendGuard.Domain.Entities;

public class DiscrepancyException
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ReconciliationRunId { get; set; }
    public Guid? InternalTransactionId { get; set; }
    public Guid? ExternalTransactionId { get; set; }
    public string ExceptionType { get; set; } = Domain.ExceptionType.AmountMismatch;
    public string Severity { get; set; } = ExceptionSeverity.Medium;
    public string Status { get; set; } = ExceptionStatus.Open;
    public decimal? ExpectedAmount { get; set; }
    public decimal? ActualAmount { get; set; }
    public decimal? DiscrepancyAmount { get; set; }
    public Guid? AssignedTo { get; set; }
    public string? ResolutionCategory { get; set; }
    public string? ResolutionExplanation { get; set; }
    public Guid? ResolvedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ResolvedAt { get; set; }

    public ReconciliationRun? ReconciliationRun { get; set; }
    public Transaction? InternalTransaction { get; set; }
    public Transaction? ExternalTransaction { get; set; }
    public User? Assignee { get; set; }
    public User? Resolver { get; set; }
    public ICollection<InvestigationNote> Notes { get; set; } = new List<InvestigationNote>();
    public ICollection<AiAnalysis> AiAnalyses { get; set; } = new List<AiAnalysis>();
}
