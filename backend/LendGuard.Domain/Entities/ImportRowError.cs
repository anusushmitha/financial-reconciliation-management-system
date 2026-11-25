using System;

namespace LendGuard.Domain.Entities;

public class ImportRowError
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ImportBatchId { get; set; }
    public int RowNumber { get; set; }
    public string? FieldName { get; set; }
    public string ErrorCode { get; set; } = string.Empty;
    public string ErrorMessage { get; set; } = string.Empty;
    public string? RawRow { get; set; }

    public ImportBatch? ImportBatch { get; set; }
}
