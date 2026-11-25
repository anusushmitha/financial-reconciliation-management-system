using System;
using System.Collections.Generic;

namespace LendGuard.Domain.Entities;

public class ImportBatch
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string BatchReference { get; set; } = string.Empty;
    public string SourceType { get; set; } = Domain.SourceType.Internal;
    public string FileName { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public string FileHash { get; set; } = string.Empty;
    public int TotalRows { get; set; } = 0;
    public int ValidRows { get; set; } = 0;
    public int RejectedRows { get; set; } = 0;
    public int DuplicateRows { get; set; } = 0;
    public string Status { get; set; } = ImportBatchStatus.Received;
    public Guid UploadedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ConfirmedAt { get; set; }

    public User? Uploader { get; set; }
    public ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();
    public ICollection<ImportRowError> RowErrors { get; set; } = new List<ImportRowError>();
    public ICollection<ReconciliationRun> InternalReconciliationRuns { get; set; } = new List<ReconciliationRun>();
    public ICollection<ReconciliationRun> ExternalReconciliationRuns { get; set; } = new List<ReconciliationRun>();
}
