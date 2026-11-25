using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using CsvHelper;
using CsvHelper.Configuration;
using LendGuard.Application.Common.Interfaces;
using LendGuard.Application.Common.Models;
using LendGuard.Application.DTOs;
using LendGuard.Domain;
using LendGuard.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace LendGuard.Application.Services;

public interface IImportService
{
    Task<UploadImportResponse> UploadFileAsync(Stream fileStream, string fileName, string sourceType, Guid userId, CancellationToken cancellationToken = default);
    Task<PaginatedList<ImportBatchSummaryDto>> GetBatchesAsync(int page = 1, int pageSize = 20, string? sourceType = null, string? status = null, CancellationToken cancellationToken = default);
    Task<ImportBatchDetailDto> GetBatchByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<ValidationResultDto> GetValidationResultsAsync(Guid id, int page = 1, int pageSize = 20, CancellationToken cancellationToken = default);
    Task<ConfirmImportResponse> ConfirmBatchAsync(Guid id, bool confirmValidRows, Guid userId, CancellationToken cancellationToken = default);
}

public class ParsedRow
{
    public int RowNumber { get; set; }
    public string TransactionReference { get; set; } = string.Empty;
    public string? ExternalReference { get; set; }
    public DateTimeOffset TransactionDate { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "INR";
    public string? TransactionType { get; set; }
    public string RawJson { get; set; } = "{}";
    public bool IsValid { get; set; }
    public List<ImportRowError> Errors { get; set; } = new();
}

public class ImportService : IImportService
{
    private readonly IApplicationDbContext _context;
    private readonly IFileStorageService _fileStorage;
    private readonly IAuditService _auditService;

    public ImportService(IApplicationDbContext context, IFileStorageService fileStorage, IAuditService auditService)
    {
        _context = context;
        _fileStorage = fileStorage;
        _auditService = auditService;
    }

    public async Task<UploadImportResponse> UploadFileAsync(Stream fileStream, string fileName, string sourceType, Guid userId, CancellationToken cancellationToken = default)
    {
        var normalizedSource = sourceType.Trim().ToUpperInvariant();
        if (normalizedSource != SourceType.Internal && normalizedSource != SourceType.External)
        {
            throw new ArgumentException("sourceType must be INTERNAL or EXTERNAL.");
        }

        if (string.IsNullOrWhiteSpace(fileName) || !fileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException("Unsupported file type. Only CSV files are accepted.");
        }

        // Save file persistently and calculate hash
        var (filePath, fileHash) = await _fileStorage.SaveUploadAsync(fileStream, fileName, cancellationToken);

        // Generate batch reference
        var datePrefix = DateTimeOffset.UtcNow.ToString("yyyyMMdd");
        var existingCountToday = await _context.ImportBatches.CountAsync(b => b.BatchReference.StartsWith($"IMP-{datePrefix}"), cancellationToken);
        var batchRef = $"IMP-{datePrefix}-{(existingCountToday + 1):D3}";

        var batch = new ImportBatch
        {
            Id = Guid.NewGuid(),
            BatchReference = batchRef,
            SourceType = normalizedSource,
            FileName = fileName,
            FilePath = filePath,
            FileHash = fileHash,
            Status = ImportBatchStatus.Validating,
            UploadedBy = userId,
            CreatedAt = DateTimeOffset.UtcNow
        };

        _context.ImportBatches.Add(batch);
        await _context.SaveChangesAsync(cancellationToken);

        // Validate the uploaded CSV file
        await ValidateBatchCsvAsync(batch, cancellationToken);

        await _auditService.LogAsync("IMPORT_UPLOADED", "IMPORT_BATCH", batch.Id, userId, new { batchReference = batch.BatchReference, sourceType = batch.SourceType, fileName = batch.FileName, hash = batch.FileHash }, null, cancellationToken);

        return new UploadImportResponse
        {
            ImportId = batch.Id,
            Status = batch.Status,
            Message = "File received and validated."
        };
    }

    private async Task ValidateBatchCsvAsync(ImportBatch batch, CancellationToken cancellationToken)
    {
        var rowErrors = new List<ImportRowError>();
        var seenReferences = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        int total = 0;
        int valid = 0;
        int rejected = 0;
        int duplicates = 0;

        using var stream = await _fileStorage.OpenReadAsync(batch.FilePath, cancellationToken);
        using var reader = new StreamReader(stream);
        using var csv = new CsvReader(reader, new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            HasHeaderRecord = true,
            TrimOptions = TrimOptions.Trim,
            IgnoreBlankLines = true,
            MissingFieldFound = null,
            BadDataFound = null
        });

        const int MaxAllowedRows = 50000;

        if (!await csv.ReadAsync() || !csv.ReadHeader())
        {
            batch.Status = ImportBatchStatus.Failed;
            await _context.SaveChangesAsync(cancellationToken);
            return;
        }

        var headers = csv.HeaderRecord?.Select(h => h.Trim().ToLowerInvariant()).ToList() ?? new List<string>();
        int rowNumber = 1; // 1-based data rows

        while (await csv.ReadAsync())
        {
            rowNumber++;
            total++;

            if (total > MaxAllowedRows)
            {
                rowErrors.Add(new ImportRowError
                {
                    Id = Guid.NewGuid(),
                    ImportBatchId = batch.Id,
                    RowNumber = rowNumber,
                    FieldName = "FILE",
                    ErrorCode = "MAX_ROW_LIMIT_EXCEEDED",
                    ErrorMessage = $"File exceeds the maximum allowable limit of {MaxAllowedRows:N0} rows.",
                    RawRow = "{}"
                });
                batch.Status = ImportBatchStatus.Failed;
                break;
            }

            var rawDict = new Dictionary<string, string>();
            foreach (var h in headers)
            {
                rawDict[h] = csv.GetField(h) ?? "";
            }
            var rawJson = JsonSerializer.Serialize(rawDict);

            bool rowHasError = false;

            // 1. transaction_reference check
            var txnRef = (csv.GetField("transaction_reference") ?? csv.GetField("transactionreference") ?? "").Trim();
            if (string.IsNullOrWhiteSpace(txnRef))
            {
                rowErrors.Add(new ImportRowError
                {
                    Id = Guid.NewGuid(),
                    ImportBatchId = batch.Id,
                    RowNumber = rowNumber,
                    FieldName = "transaction_reference",
                    ErrorCode = "REQUIRED_FIELD_MISSING",
                    ErrorMessage = "Transaction reference is required.",
                    RawRow = rawJson
                });
                rowHasError = true;
            }
            else if (txnRef.Length > 150)
            {
                rowErrors.Add(new ImportRowError
                {
                    Id = Guid.NewGuid(),
                    ImportBatchId = batch.Id,
                    RowNumber = rowNumber,
                    FieldName = "transaction_reference",
                    ErrorCode = "FIELD_TOO_LONG",
                    ErrorMessage = "Transaction reference exceeds maximum length of 150 characters.",
                    RawRow = rawJson
                });
                rowHasError = true;
            }

            // In-batch duplicate reference check
            if (!string.IsNullOrWhiteSpace(txnRef))
            {
                if (seenReferences.Contains(txnRef))
                {
                    rowErrors.Add(new ImportRowError
                    {
                        Id = Guid.NewGuid(),
                        ImportBatchId = batch.Id,
                        RowNumber = rowNumber,
                        FieldName = "transaction_reference",
                        ErrorCode = "DUPLICATE_IN_FILE",
                        ErrorMessage = $"Duplicate transaction reference '{txnRef}' found in the same file.",
                        RawRow = rawJson
                    });
                    duplicates++;
                    rowHasError = true;
                }
                else
                {
                    seenReferences.Add(txnRef);
                }
            }

            // 2. amount check
            var amtStr = (csv.GetField("amount") ?? "").Trim();
            if (string.IsNullOrWhiteSpace(amtStr) || !decimal.TryParse(amtStr, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsedAmount))
            {
                rowErrors.Add(new ImportRowError
                {
                    Id = Guid.NewGuid(),
                    ImportBatchId = batch.Id,
                    RowNumber = rowNumber,
                    FieldName = "amount",
                    ErrorCode = "INVALID_DECIMAL",
                    ErrorMessage = "Amount must be a valid decimal number.",
                    RawRow = rawJson
                });
                rowHasError = true;
            }

            // 3. transaction_date check
            var dateStr = (csv.GetField("transaction_date") ?? csv.GetField("transactiondate") ?? "").Trim();
            if (string.IsNullOrWhiteSpace(dateStr) || !DateTimeOffset.TryParse(dateStr, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out _))
            {
                rowErrors.Add(new ImportRowError
                {
                    Id = Guid.NewGuid(),
                    ImportBatchId = batch.Id,
                    RowNumber = rowNumber,
                    FieldName = "transaction_date",
                    ErrorCode = "INVALID_DATE_FORMAT",
                    ErrorMessage = "Transaction date must be a valid ISO 8601 UTC timestamp.",
                    RawRow = rawJson
                });
                rowHasError = true;
            }

            // 4. currency check
            var curr = (csv.GetField("currency") ?? "INR").Trim().ToUpperInvariant();
            if (curr.Length != 3)
            {
                rowErrors.Add(new ImportRowError
                {
                    Id = Guid.NewGuid(),
                    ImportBatchId = batch.Id,
                    RowNumber = rowNumber,
                    FieldName = "currency",
                    ErrorCode = "INVALID_CURRENCY",
                    ErrorMessage = "Currency must be an ISO 3-character code (e.g., INR).",
                    RawRow = rawJson
                });
                rowHasError = true;
            }

            if (rowHasError)
            {
                rejected++;
            }
            else
            {
                valid++;
            }
        }

        batch.TotalRows = total;
        batch.ValidRows = valid;
        batch.RejectedRows = rejected;
        batch.DuplicateRows = duplicates;
        batch.Status = ImportBatchStatus.ValidationCompleted;

        if (rowErrors.Any())
        {
            _context.ImportRowErrors.AddRange(rowErrors);
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<PaginatedList<ImportBatchSummaryDto>> GetBatchesAsync(int page = 1, int pageSize = 20, string? sourceType = null, string? status = null, CancellationToken cancellationToken = default)
    {
        var query = _context.ImportBatches.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(sourceType))
        {
            query = query.Where(b => b.SourceType == sourceType.Trim().ToUpper());
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(b => b.Status == status.Trim().ToUpper());
        }

        var total = await query.CountAsync(cancellationToken);
        var items = await query.OrderByDescending(b => b.CreatedAt)
                               .Skip((page - 1) * pageSize)
                               .Take(pageSize)
                               .Select(b => new ImportBatchSummaryDto
                               {
                                   Id = b.Id,
                                   BatchReference = b.BatchReference,
                                   SourceType = b.SourceType,
                                   FileName = b.FileName,
                                   TotalRows = b.TotalRows,
                                   ValidRows = b.ValidRows,
                                   RejectedRows = b.RejectedRows,
                                   DuplicateRows = b.DuplicateRows,
                                   Status = b.Status,
                                   CreatedAt = b.CreatedAt
                               })
                               .ToListAsync(cancellationToken);

        return new PaginatedList<ImportBatchSummaryDto>(items, total, page, pageSize);
    }

    public async Task<ImportBatchDetailDto> GetBatchByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var batch = await _context.ImportBatches.AsNoTracking()
            .Include(b => b.Uploader)
            .FirstOrDefaultAsync(b => b.Id == id, cancellationToken);

        if (batch == null)
        {
            throw new KeyNotFoundException("Import batch not found.");
        }

        return new ImportBatchDetailDto
        {
            Id = batch.Id,
            BatchReference = batch.BatchReference,
            SourceType = batch.SourceType,
            FileName = batch.FileName,
            TotalRows = batch.TotalRows,
            ValidRows = batch.ValidRows,
            RejectedRows = batch.RejectedRows,
            DuplicateRows = batch.DuplicateRows,
            Status = batch.Status,
            UploadedBy = new UserProfileDto
            {
                Id = batch.Uploader?.Id ?? Guid.Empty,
                FullName = batch.Uploader?.FullName ?? "Unknown",
                Email = batch.Uploader?.Email ?? "",
                Role = batch.Uploader?.Role ?? ""
            },
            CreatedAt = batch.CreatedAt,
            ConfirmedAt = batch.ConfirmedAt
        };
    }

    public async Task<ValidationResultDto> GetValidationResultsAsync(Guid id, int page = 1, int pageSize = 20, CancellationToken cancellationToken = default)
    {
        var batch = await _context.ImportBatches.AsNoTracking().FirstOrDefaultAsync(b => b.Id == id, cancellationToken);
        if (batch == null)
        {
            throw new KeyNotFoundException("Import batch not found.");
        }

        var errorQuery = _context.ImportRowErrors.AsNoTracking().Where(e => e.ImportBatchId == id);
        var totalErrors = await errorQuery.CountAsync(cancellationToken);

        var errors = await errorQuery.OrderBy(e => e.RowNumber)
                                     .Skip((page - 1) * pageSize)
                                     .Take(pageSize)
                                     .Select(e => new ImportRowErrorDto
                                     {
                                         RowNumber = e.RowNumber,
                                         FieldName = e.FieldName,
                                         ErrorCode = e.ErrorCode,
                                         ErrorMessage = e.ErrorMessage,
                                         RawRow = e.RawRow
                                     })
                                     .ToListAsync(cancellationToken);

        return new ValidationResultDto
        {
            BatchId = batch.Id,
            TotalRows = batch.TotalRows,
            ValidRows = batch.ValidRows,
            RejectedRows = batch.RejectedRows,
            DuplicateRows = batch.DuplicateRows,
            Errors = errors,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalErrors
        };
    }

    public async Task<ConfirmImportResponse> ConfirmBatchAsync(Guid id, bool confirmValidRows, Guid userId, CancellationToken cancellationToken = default)
    {
        var batch = await _context.ImportBatches.FirstOrDefaultAsync(b => b.Id == id, cancellationToken);
        if (batch == null)
        {
            throw new KeyNotFoundException("Import batch not found.");
        }

        // Idempotency: repeated call returns existing confirmed status
        if (batch.Status == ImportBatchStatus.Imported || batch.Status == ImportBatchStatus.PartiallyImported)
        {
            return new ConfirmImportResponse
            {
                ImportId = batch.Id,
                Status = batch.Status,
                ImportedRows = batch.ValidRows,
                RejectedRows = batch.RejectedRows,
                DuplicateRows = batch.DuplicateRows,
                Message = "Batch is already confirmed and imported."
            };
        }

        if (batch.Status != ImportBatchStatus.ValidationCompleted)
        {
            throw new InvalidOperationException($"Batch cannot be confirmed in its current status '{batch.Status}'.");
        }

        if (!confirmValidRows)
        {
            throw new ArgumentException("confirmValidRows must be true to proceed.");
        }

        // Re-read file to persist all valid rows into transactions table
        var errorRowNumbers = (await _context.ImportRowErrors
            .Where(e => e.ImportBatchId == id)
            .Select(e => e.RowNumber)
            .ToListAsync(cancellationToken)).ToHashSet();

        var transactionsToInsert = new List<Transaction>();

        using (var stream = await _fileStorage.OpenReadAsync(batch.FilePath, cancellationToken))
        using (var reader = new StreamReader(stream))
        using (var csv = new CsvReader(reader, new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            HasHeaderRecord = true,
            TrimOptions = TrimOptions.Trim,
            IgnoreBlankLines = true
        }))
        {
            await csv.ReadAsync();
            csv.ReadHeader();
            var headers = csv.HeaderRecord?.Select(h => h.Trim().ToLowerInvariant()).ToList() ?? new List<string>();

            int rowNumber = 1;
            while (await csv.ReadAsync())
            {
                rowNumber++;
                if (errorRowNumbers.Contains(rowNumber))
                {
                    continue; // Skip rejected rows
                }

                var rawDict = new Dictionary<string, string>();
                foreach (var h in headers)
                {
                    rawDict[h] = csv.GetField(h) ?? "";
                }

                var txnRef = (csv.GetField("transaction_reference") ?? csv.GetField("transactionreference") ?? "").Trim();
                var extRef = (csv.GetField("external_reference") ?? csv.GetField("externalreference") ?? "").Trim();
                var dateStr = (csv.GetField("transaction_date") ?? csv.GetField("transactiondate") ?? "").Trim();
                var amtStr = (csv.GetField("amount") ?? "0").Trim();
                var curr = (csv.GetField("currency") ?? "INR").Trim().ToUpperInvariant();
                var txnType = (csv.GetField("transaction_type") ?? csv.GetField("transactiontype") ?? "").Trim();

                DateTimeOffset.TryParse(dateStr, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var txnDate);
                decimal.TryParse(amtStr, NumberStyles.Number, CultureInfo.InvariantCulture, out var amt);

                var txn = new Transaction
                {
                    Id = Guid.NewGuid(),
                    ImportBatchId = batch.Id,
                    SourceRowNumber = rowNumber,
                    TransactionReference = txnRef,
                    ExternalReference = string.IsNullOrWhiteSpace(extRef) ? null : extRef,
                    TransactionDate = txnDate,
                    Amount = amt,
                    Currency = curr,
                    TransactionType = string.IsNullOrWhiteSpace(txnType) ? null : txnType,
                    SourceType = batch.SourceType,
                    Status = TransactionStatus.Pending,
                    RawData = JsonSerializer.Serialize(rawDict),
                    CreatedAt = DateTimeOffset.UtcNow
                };

                transactionsToInsert.Add(txn);
            }
        }

        if (transactionsToInsert.Any())
        {
            _context.Transactions.AddRange(transactionsToInsert);
        }

        batch.Status = batch.RejectedRows > 0 || batch.DuplicateRows > 0 ? ImportBatchStatus.PartiallyImported : ImportBatchStatus.Imported;
        batch.ConfirmedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync("IMPORT_CONFIRMED", "IMPORT_BATCH", batch.Id, userId, new { batchReference = batch.BatchReference, importedRows = transactionsToInsert.Count, rejectedRows = batch.RejectedRows }, null, cancellationToken);

        return new ConfirmImportResponse
        {
            ImportId = batch.Id,
            Status = batch.Status,
            ImportedRows = transactionsToInsert.Count,
            RejectedRows = batch.RejectedRows,
            DuplicateRows = batch.DuplicateRows,
            Message = "Valid rows imported."
        };
    }
}
