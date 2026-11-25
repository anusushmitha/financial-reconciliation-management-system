using System;
using System.Collections.Generic;

namespace LendGuard.Application.DTOs;

public class TransactionSummaryDto
{
    public Guid Id { get; set; }
    public string TransactionReference { get; set; } = string.Empty;
    public string? ExternalReference { get; set; }
    public DateTimeOffset TransactionDate { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "INR";
    public string? TransactionType { get; set; }
    public string SourceType { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public Guid ImportBatchId { get; set; }
}

public class TransactionDetailDto
{
    public Guid Id { get; set; }
    public string TransactionReference { get; set; } = string.Empty;
    public string? ExternalReference { get; set; }
    public DateTimeOffset TransactionDate { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "INR";
    public string? TransactionType { get; set; }
    public string SourceType { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public Guid ImportBatchId { get; set; }
    public string? BatchReference { get; set; }
    public string RawData { get; set; } = "{}";
    public List<Guid> RelatedMatchIds { get; set; } = new();
    public List<Guid> RelatedExceptionIds { get; set; } = new();
}

public class TransactionFilterParams
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public string? Search { get; set; }
    public string? SourceType { get; set; }
    public string? Status { get; set; }
    public DateTimeOffset? From { get; set; }
    public DateTimeOffset? To { get; set; }
}
