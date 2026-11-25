using System;
using System.Collections.Generic;

namespace LendGuard.Application.DTOs;

public class ExceptionSummaryDto
{
    public Guid Id { get; set; }
    public string ExceptionType { get; set; } = string.Empty;
    public string Severity { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public decimal? DiscrepancyAmount { get; set; }
    public string Currency { get; set; } = "INR";
    public UserProfileDto? AssignedTo { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public class ExceptionDetailDto
{
    public Guid Id { get; set; }
    public string ExceptionType { get; set; } = string.Empty;
    public string Severity { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public decimal? ExpectedAmount { get; set; }
    public decimal? ActualAmount { get; set; }
    public decimal? DiscrepancyAmount { get; set; }
    public string Currency { get; set; } = "INR";
    public Guid? InternalTransactionId { get; set; }
    public Guid? ExternalTransactionId { get; set; }
    public UserProfileDto? AssignedTo { get; set; }
    public object? Evidence { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset? ResolvedAt { get; set; }
    public string? ResolutionCategory { get; set; }
    public string? ResolutionExplanation { get; set; }
    public UserProfileDto? ResolvedBy { get; set; }
    public TransactionSummaryDto? InternalTransaction { get; set; }
    public TransactionSummaryDto? ExternalTransaction { get; set; }
}

public class AssignExceptionRequest
{
    public Guid AssignedTo { get; set; }
}

public class AddInvestigationNoteRequest
{
    public string Note { get; set; } = string.Empty;
}

public class InvestigationNoteDto
{
    public Guid Id { get; set; }
    public Guid ExceptionId { get; set; }
    public Guid UserId { get; set; }
    public string? UserName { get; set; }
    public string Note { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
}

public class TriggerAiAnalysisRequest
{
    public string AnalysisType { get; set; } = "EXPLANATION";
}

public class TriggerAiAnalysisResponse
{
    public Guid AnalysisId { get; set; }
    public string Status { get; set; } = "PENDING";
}

public class AiAnalysisDto
{
    public Guid AnalysisId { get; set; }
    public string Status { get; set; } = string.Empty;
    public string AnalysisType { get; set; } = string.Empty;
    public string? Summary { get; set; }
    public object? Evidence { get; set; }
    public string? Recommendation { get; set; }
    public bool AdvisoryOnly { get; set; } = true;
    public string? ModelName { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public class ResolveExceptionRequest
{
    public string ResolutionCategory { get; set; } = string.Empty;
    public string Explanation { get; set; } = string.Empty;
}
