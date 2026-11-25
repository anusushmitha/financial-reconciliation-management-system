using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using CsvHelper;
using LendGuard.Application.Common.Interfaces;
using LendGuard.Application.DTOs;
using LendGuard.Domain;
using Microsoft.EntityFrameworkCore;

namespace LendGuard.Application.Services;

public interface IReportService
{
    Task<ReconciliationReportDto> GetReconciliationReportAsync(DateTimeOffset? dateFrom, DateTimeOffset? dateTo, string? status, string? source, CancellationToken cancellationToken = default);
    Task<ExceptionReportDto> GetExceptionReportAsync(DateTimeOffset? dateFrom, DateTimeOffset? dateTo, string? type, string? severity, string? status, CancellationToken cancellationToken = default);
    Task<byte[]> ExportReconciliationCsvAsync(DateTimeOffset? dateFrom, DateTimeOffset? dateTo, string? status, CancellationToken cancellationToken = default);
    Task<byte[]> ExportExceptionsCsvAsync(DateTimeOffset? dateFrom, DateTimeOffset? dateTo, string? type, string? severity, string? status, CancellationToken cancellationToken = default);
}

public class ReportService : IReportService
{
    private readonly IApplicationDbContext _context;
    private readonly IAuditService _auditService;

    public ReportService(IApplicationDbContext context, IAuditService auditService)
    {
        _context = context;
        _auditService = auditService;
    }

    public async Task<ReconciliationReportDto> GetReconciliationReportAsync(DateTimeOffset? dateFrom, DateTimeOffset? dateTo, string? status, string? source, CancellationToken cancellationToken = default)
    {
        var query = _context.ReconciliationRuns.AsNoTracking().AsQueryable();

        if (dateFrom.HasValue) { var utcFrom = dateFrom.Value.ToUniversalTime(); query = query.Where(r => r.StartedAt >= utcFrom); }
        if (dateTo.HasValue) { var utcTo = dateTo.Value.ToUniversalTime(); query = query.Where(r => r.StartedAt <= utcTo); }
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(r => r.Status == status.Trim().ToUpper());

        var runs = await query.ToListAsync(cancellationToken);

        int totalRuns = runs.Count;
        int totalInternal = runs.Sum(r => r.TotalInternal);
        int totalExternal = runs.Sum(r => r.TotalExternal);
        int matched = runs.Sum(r => r.MatchedCount);
        int exceptions = runs.Sum(r => r.ExceptionCount);

        var runIds = runs.Select(r => r.Id).ToList();
        var actualMatchedTxns = await _context.ReconciliationMatchItems.AsNoTracking()
            .Where(mi => mi.ReconciliationMatch != null && runIds.Contains(mi.ReconciliationMatch.ReconciliationRunId))
            .Select(mi => mi.TransactionId)
            .Distinct()
            .CountAsync(cancellationToken);

        int matchedTransactions = actualMatchedTxns > 0 ? actualMatchedTxns : matched * 2;
        int totalTransactions = totalInternal + totalExternal;
        decimal matchRate = totalTransactions > 0
            ? Math.Round(((decimal)matchedTransactions / totalTransactions) * 100m, 1)
            : 0m;

        return new ReconciliationReportDto
        {
            Filters = new Dictionary<string, string?>
            {
                ["dateFrom"] = dateFrom?.ToString("yyyy-MM-dd"),
                ["dateTo"] = dateTo?.ToString("yyyy-MM-dd"),
                ["status"] = status
            },
            Totals = new ReconciliationReportTotals
            {
                Runs = totalRuns,
                InternalTransactions = totalInternal,
                ExternalTransactions = totalExternal,
                Matched = matched,
                MatchedTransactions = matchedTransactions,
                Exceptions = exceptions
            },
            MatchRate = matchRate
        };
    }

    public async Task<ExceptionReportDto> GetExceptionReportAsync(DateTimeOffset? dateFrom, DateTimeOffset? dateTo, string? type, string? severity, string? status, CancellationToken cancellationToken = default)
    {
        var query = _context.Exceptions.AsNoTracking().AsQueryable();

        if (dateFrom.HasValue) { var utcFrom = dateFrom.Value.ToUniversalTime(); query = query.Where(e => e.CreatedAt >= utcFrom); }
        if (dateTo.HasValue) { var utcTo = dateTo.Value.ToUniversalTime(); query = query.Where(e => e.CreatedAt <= utcTo); }
        if (!string.IsNullOrWhiteSpace(type)) query = query.Where(e => e.ExceptionType == type.Trim().ToUpper());
        if (!string.IsNullOrWhiteSpace(severity)) query = query.Where(e => e.Severity == severity.Trim().ToUpper());
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(e => e.Status == status.Trim().ToUpper());

        var exceptions = await query.ToListAsync(cancellationToken);

        var total = exceptions.Count;
        var low = exceptions.Count(e => e.Severity == ExceptionSeverity.Low);
        var med = exceptions.Count(e => e.Severity == ExceptionSeverity.Medium);
        var high = exceptions.Count(e => e.Severity == ExceptionSeverity.High);
        var crit = exceptions.Count(e => e.Severity == ExceptionSeverity.Critical);

        var byType = exceptions.GroupBy(e => e.ExceptionType)
                               .Select(g => new ExceptionTypeCount { Type = g.Key, Count = g.Count() })
                               .OrderByDescending(x => x.Count)
                               .ToList();

        return new ExceptionReportDto
        {
            Filters = new Dictionary<string, string?>
            {
                ["status"] = status ?? "ALL"
            },
            Totals = new ExceptionReportTotals
            {
                Total = total,
                Low = low,
                Medium = med,
                High = high,
                Critical = crit
            },
            ByType = byType
        };
    }

    public async Task<byte[]> ExportReconciliationCsvAsync(DateTimeOffset? dateFrom, DateTimeOffset? dateTo, string? status, CancellationToken cancellationToken = default)
    {
        var query = _context.ReconciliationRuns.AsNoTracking().AsQueryable();
        if (dateFrom.HasValue) { var utcFrom = dateFrom.Value.ToUniversalTime(); query = query.Where(r => r.StartedAt >= utcFrom); }
        if (dateTo.HasValue) { var utcTo = dateTo.Value.ToUniversalTime(); query = query.Where(r => r.StartedAt <= utcTo); }
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(r => r.Status == status.Trim().ToUpper());

        var runs = await query.OrderByDescending(r => r.StartedAt).ToListAsync(cancellationToken);

        using var memoryStream = new MemoryStream();
        using (var writer = new StreamWriter(memoryStream, Encoding.UTF8))
        using (var csv = new CsvWriter(writer, CultureInfo.InvariantCulture))
        {
            csv.WriteField("Run ID");
            csv.WriteField("Status");
            csv.WriteField("Internal Batch");
            csv.WriteField("External Batch");
            csv.WriteField("Matched Count");
            csv.WriteField("Exception Count");
            csv.WriteField("Started At");
            csv.WriteField("Completed At");
            csv.NextRecord();

            foreach (var r in runs)
            {
                csv.WriteField(SanitizeForCsv(r.Id.ToString()));
                csv.WriteField(SanitizeForCsv(r.Status));
                csv.WriteField(SanitizeForCsv(r.InternalBatchId.ToString()));
                csv.WriteField(SanitizeForCsv(r.ExternalBatchId.ToString()));
                csv.WriteField(r.MatchedCount);
                csv.WriteField(r.ExceptionCount);
                csv.WriteField(r.StartedAt.ToString("O"));
                csv.WriteField(r.CompletedAt?.ToString("O") ?? "");
                csv.NextRecord();
            }
        }

        return memoryStream.ToArray();
    }

    public async Task<byte[]> ExportExceptionsCsvAsync(DateTimeOffset? dateFrom, DateTimeOffset? dateTo, string? type, string? severity, string? status, CancellationToken cancellationToken = default)
    {
        var query = _context.Exceptions.AsNoTracking().AsQueryable();
        if (dateFrom.HasValue) { var utcFrom = dateFrom.Value.ToUniversalTime(); query = query.Where(e => e.CreatedAt >= utcFrom); }
        if (dateTo.HasValue) { var utcTo = dateTo.Value.ToUniversalTime(); query = query.Where(e => e.CreatedAt <= utcTo); }
        if (!string.IsNullOrWhiteSpace(type)) query = query.Where(e => e.ExceptionType == type.Trim().ToUpper());
        if (!string.IsNullOrWhiteSpace(severity)) query = query.Where(e => e.Severity == severity.Trim().ToUpper());
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(e => e.Status == status.Trim().ToUpper());

        var exceptions = await query.OrderByDescending(e => e.CreatedAt).ToListAsync(cancellationToken);

        using var memoryStream = new MemoryStream();
        using (var writer = new StreamWriter(memoryStream, Encoding.UTF8))
        using (var csv = new CsvWriter(writer, CultureInfo.InvariantCulture))
        {
            csv.WriteField("Exception ID");
            csv.WriteField("Type");
            csv.WriteField("Severity");
            csv.WriteField("Status");
            csv.WriteField("Expected Amount");
            csv.WriteField("Actual Amount");
            csv.WriteField("Discrepancy Amount");
            csv.WriteField("Resolution Category");
            csv.WriteField("Created At");
            csv.NextRecord();

            foreach (var e in exceptions)
            {
                csv.WriteField(SanitizeForCsv(e.Id.ToString()));
                csv.WriteField(SanitizeForCsv(e.ExceptionType));
                csv.WriteField(SanitizeForCsv(e.Severity));
                csv.WriteField(SanitizeForCsv(e.Status));
                csv.WriteField(e.ExpectedAmount?.ToString("F2") ?? "");
                csv.WriteField(e.ActualAmount?.ToString("F2") ?? "");
                csv.WriteField(e.DiscrepancyAmount?.ToString("F2") ?? "");
                csv.WriteField(SanitizeForCsv(e.ResolutionCategory ?? ""));
                csv.WriteField(e.CreatedAt.ToString("O"));
                csv.NextRecord();
            }
        }

        return memoryStream.ToArray();
    }

    // CSV Formula Injection Defense (Neutralize leading =, +, -, @)
    private static string SanitizeForCsv(string input)
    {
        if (string.IsNullOrEmpty(input)) return "";
        var first = input[0];
        if (first == '=' || first == '+' || first == '-' || first == '@')
        {
            return "'" + input;
        }
        return input;
    }
}
