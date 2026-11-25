using System;

namespace LendGuard.Domain.Entities;

public class AiAnalysis
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ExceptionId { get; set; }
    public string AnalysisType { get; set; } = AiAnalysisType.Explanation;
    public string? ModelName { get; set; }
    public string? ModelVersion { get; set; }
    public string? Result { get; set; }
    public string Status { get; set; } = AiAnalysisStatus.Pending;
    public string? FailureCode { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? CompletedAt { get; set; }

    public DiscrepancyException? Exception { get; set; }
}
