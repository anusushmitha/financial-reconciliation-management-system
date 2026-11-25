using System;
using System.Collections.Generic;

namespace LendGuard.Application.DTOs;

public class UploadImportResponse
{
    public Guid ImportId { get; set; }
    public string Status { get; set; } = "VALIDATING";
    public string Message { get; set; } = "File received for validation.";
}

public class ImportBatchSummaryDto
{
    public Guid Id { get; set; }
    public string BatchReference { get; set; } = string.Empty;
    public string SourceType { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public int TotalRows { get; set; }
    public int ValidRows { get; set; }
    public int RejectedRows { get; set; }
    public int DuplicateRows { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
}

public class ImportBatchDetailDto
{
    public Guid Id { get; set; }
    public string BatchReference { get; set; } = string.Empty;
    public string SourceType { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public int TotalRows { get; set; }
    public int ValidRows { get; set; }
    public int RejectedRows { get; set; }
    public int DuplicateRows { get; set; }
    public string Status { get; set; } = string.Empty;
    public UserProfileDto UploadedBy { get; set; } = new();
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ConfirmedAt { get; set; }
}

public class ImportRowErrorDto
{
    public int RowNumber { get; set; }
    public string? FieldName { get; set; }
    public string ErrorCode { get; set; } = string.Empty;
    public string ErrorMessage { get; set; } = string.Empty;
    public string? RawRow { get; set; }
}

public class ValidationResultDto
{
    public Guid BatchId { get; set; }
    public int TotalRows { get; set; }
    public int ValidRows { get; set; }
    public int RejectedRows { get; set; }
    public int DuplicateRows { get; set; }
    public List<ImportRowErrorDto> Errors { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
}

public class ConfirmImportRequest
{
    public bool ConfirmValidRows { get; set; }
}

public class ConfirmImportResponse
{
    public Guid ImportId { get; set; }
    public string Status { get; set; } = string.Empty;
    public int ImportedRows { get; set; }
    public int RejectedRows { get; set; }
    public int DuplicateRows { get; set; }
    public string Message { get; set; } = string.Empty;
}
