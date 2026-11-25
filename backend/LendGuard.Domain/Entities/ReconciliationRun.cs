using System;
using System.Collections.Generic;

namespace LendGuard.Domain.Entities;

public class ReconciliationRun
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid InternalBatchId { get; set; }
    public Guid ExternalBatchId { get; set; }
    public string Status { get; set; } = ReconciliationRunStatus.Queued;
    public int TotalInternal { get; set; } = 0;
    public int TotalExternal { get; set; } = 0;
    public int MatchedCount { get; set; } = 0;
    public int ExceptionCount { get; set; } = 0;
    public Guid StartedBy { get; set; }
    public string RuleVersion { get; set; } = "recon-v1";
    public DateTimeOffset StartedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? CompletedAt { get; set; }
    public string? FailureCode { get; set; }
    public string? FailureMessage { get; set; }

    public ImportBatch? InternalBatch { get; set; }
    public ImportBatch? ExternalBatch { get; set; }
    public User? Starter { get; set; }
    public ICollection<ReconciliationMatch> Matches { get; set; } = new List<ReconciliationMatch>();
    public ICollection<DiscrepancyException> Exceptions { get; set; } = new List<DiscrepancyException>();
}
