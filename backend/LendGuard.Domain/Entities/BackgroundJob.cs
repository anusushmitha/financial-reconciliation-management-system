using System;

namespace LendGuard.Domain.Entities;

public class BackgroundJob
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string JobType { get; set; } = BackgroundJobType.Import;
    public string Payload { get; set; } = "{}";
    public string Status { get; set; } = BackgroundJobStatus.Pending;
    public int Attempts { get; set; } = 0;
    public int MaxAttempts { get; set; } = 3;
    public DateTimeOffset AvailableAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? LockedAt { get; set; }
    public string? LockedBy { get; set; }
    public string? LastError { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ProcessedAt { get; set; }
}
