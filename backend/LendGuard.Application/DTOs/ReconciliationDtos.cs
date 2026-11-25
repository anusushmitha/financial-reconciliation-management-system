using System;
using System.Collections.Generic;

namespace LendGuard.Application.DTOs;

public class StartReconciliationRequest
{
    public Guid InternalBatchId { get; set; }
    public Guid ExternalBatchId { get; set; }
    public double? DateToleranceDays { get; set; }
}

public class StartReconciliationResponse
{
    public Guid RunId { get; set; }
    public string Status { get; set; } = "QUEUED";
    public string Message { get; set; } = "Reconciliation has been queued.";
}

public class ReconciliationRunSummaryDto
{
    public Guid Id { get; set; }
    public string Status { get; set; } = string.Empty;
    public Guid InternalBatchId { get; set; }
    public Guid ExternalBatchId { get; set; }
    public int MatchedCount { get; set; }
    public int ExceptionCount { get; set; }
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
}

public class ReconciliationRunDetailDto
{
    public Guid Id { get; set; }
    public string Status { get; set; } = string.Empty;
    public Guid InternalBatchId { get; set; }
    public Guid ExternalBatchId { get; set; }
    public string? InternalBatchReference { get; set; }
    public string? ExternalBatchReference { get; set; }
    public int TotalInternal { get; set; }
    public int TotalExternal { get; set; }
    public int MatchedCount { get; set; }
    public int ExceptionCount { get; set; }
    public string RuleVersion { get; set; } = "recon-v1";
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public string? FailureCode { get; set; }
    public string? FailureMessage { get; set; }
}

public class MatchMemberDto
{
    public Guid TransactionId { get; set; }
    public string Side { get; set; } = string.Empty;
    public decimal AmountApplied { get; set; }
    public string Currency { get; set; } = "INR";
    public string? TransactionReference { get; set; }
}

public class MatchItemDto
{
    public Guid Id { get; set; }
    public string MatchType { get; set; } = string.Empty;
    public decimal? Confidence { get; set; }
    public List<MatchMemberDto> Members { get; set; } = new();
    public object? Evidence { get; set; }
}
