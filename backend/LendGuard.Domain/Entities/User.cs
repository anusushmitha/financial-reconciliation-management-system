using System;
using System.Collections.Generic;

namespace LendGuard.Domain.Entities;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Role { get; set; } = UserRole.Analyst;
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<ImportBatch> UploadedBatches { get; set; } = new List<ImportBatch>();
    public ICollection<ReconciliationRun> StartedRuns { get; set; } = new List<ReconciliationRun>();
    public ICollection<PasswordResetToken> PasswordResetTokens { get; set; } = new List<PasswordResetToken>();
    public ICollection<InvestigationNote> InvestigationNotes { get; set; } = new List<InvestigationNote>();
    public ICollection<AuditLog> AuditLogs { get; set; } = new List<AuditLog>();
}
