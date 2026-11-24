using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CsvHelper;
using CsvHelper.Configuration;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;

namespace LendGuard.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ExternalImportController : ControllerBase
    {
        private readonly LendGuardContext _context;

        public ExternalImportController(LendGuardContext context)
        {
            _context = context;
        }

        public class ImportResponseDto
        {
            public int ImportHistoryId { get; set; }
            public string FileName { get; set; } = string.Empty;
            public int TotalRows { get; set; }
            public int AcceptedRows { get; set; }
            public int RejectedRows { get; set; }
            public List<string> ErrorMessages { get; set; } = new();
        }

        [HttpPost("external")]
        public async Task<IActionResult> ImportExternal([FromForm] IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "No bank settlement CSV file uploaded." });

            var result = new ImportResponseDto { FileName = file.FileName };
            var duplicateCheck = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var validTransactions = new List<Transaction>();
            var errorLogs = new List<object>();

            using (var stream = file.OpenReadStream())
            using (var reader = new StreamReader(stream))
            {
                var config = new CsvConfiguration(CultureInfo.InvariantCulture)
                {
                    HasHeaderRecord = true,
                    MissingFieldFound = null,
                    BadDataFound = null,
                    HeaderValidated = null
                };

                using var csv = new CsvReader(reader, config);
                var records = csv.GetRecords<dynamic>();

                foreach (var record in records)
                {
                    result.TotalRows++;
                    var dict = (IDictionary<string, object>)record;

                    try
                    {
                        string? refId = null;
                        foreach (var key in dict.Keys)
                        {
                            if (key.Equals("ReferenceId", StringComparison.OrdinalIgnoreCase) || 
                                key.Equals("SettlementReference", StringComparison.OrdinalIgnoreCase) ||
                                key.Equals("TransactionReference", StringComparison.OrdinalIgnoreCase) ||
                                key.Equals("Reference", StringComparison.OrdinalIgnoreCase))
                            {
                                refId = dict[key]?.ToString()?.Trim();
                                break;
                            }
                        }

                        if (string.IsNullOrWhiteSpace(refId))
                            throw new Exception("Missing required 'ReferenceId' column or empty cell value.");

                        if (!duplicateCheck.Add(refId))
                            throw new Exception($"Duplicate Settlement Reference '{refId}' detected in bank file.");

                        string? amountStr = dict.FirstOrDefault(k => k.Key.Equals("Amount", StringComparison.OrdinalIgnoreCase) || k.Key.Equals("SettledAmount", StringComparison.OrdinalIgnoreCase)).Value?.ToString();
                        if (!decimal.TryParse(amountStr, NumberStyles.Any, CultureInfo.InvariantCulture, out decimal parsedAmount))
                            throw new Exception($"Invalid monetary settlement amount format '{amountStr}'.");

                        string? dateStr = dict.FirstOrDefault(k => k.Key.Equals("TransactionDate", StringComparison.OrdinalIgnoreCase) || k.Key.Equals("SettlementDate", StringComparison.OrdinalIgnoreCase) || k.Key.Equals("Date", StringComparison.OrdinalIgnoreCase)).Value?.ToString();
                        if (!DateTime.TryParse(dateStr, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out DateTime parsedDate))
                            parsedDate = DateTime.UtcNow;
                        else
                            parsedDate = DateTime.SpecifyKind(parsedDate, DateTimeKind.Utc);

                        string currency = dict.FirstOrDefault(k => k.Key.Equals("Currency", StringComparison.OrdinalIgnoreCase)).Value?.ToString() ?? "USD";
                        string type = dict.FirstOrDefault(k => k.Key.Equals("Type", StringComparison.OrdinalIgnoreCase)).Value?.ToString() ?? "Settlement";
                        string status = dict.FirstOrDefault(k => k.Key.Equals("Status", StringComparison.OrdinalIgnoreCase)).Value?.ToString() ?? "Settled";

                        var tx = new Transaction
                        {
                            ReferenceId = refId,
                            TransactionDate = parsedDate,
                            Amount = parsedAmount,
                            Currency = currency.Trim(),
                            Type = type.Trim(),
                            Status = status.Trim(),
                            SourceSystem = "External",
                            ReconciliationStatus = "Pending",
                            CreatedAt = DateTime.UtcNow
                        };

                        validTransactions.Add(tx);
                        result.AcceptedRows++;
                    }
                    catch (Exception ex)
                    {
                        result.RejectedRows++;
                        result.ErrorMessages.Add($"Row {result.TotalRows}: {ex.Message}");
                        errorLogs.Add(new { Row = result.TotalRows, Error = ex.Message });
                    }
                }
            }

            if (validTransactions.Any())
            {
                await _context.Transactions.AddRangeAsync(validTransactions);
            }

            var history = new ImportHistory
            {
                FileName = file.FileName,
                SourceSystem = "External",
                UploadedAt = DateTime.UtcNow,
                TotalRows = result.TotalRows,
                AcceptedRows = result.AcceptedRows,
                RejectedRows = result.RejectedRows,
                Status = result.RejectedRows > 0 ? "Completed With Warnings" : "Completed",
                ValidationErrorsJson = errorLogs.Any() ? JsonSerializer.Serialize(errorLogs) : null
            };

            await _context.ImportHistories.AddAsync(history);
            await _context.SaveChangesAsync();

            result.ImportHistoryId = history.Id;
            return Ok(result);
        }
    }
}
