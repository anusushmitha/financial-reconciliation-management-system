using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using LendGuard.Application.Common.Interfaces;
using LendGuard.Application.DTOs;
using LendGuard.Domain;
using Microsoft.EntityFrameworkCore;

namespace LendGuard.Application.Services;

public interface IDashboardService
{
    Task<DashboardSummaryDto> GetSummaryAsync(DateTimeOffset? dateFrom = null, DateTimeOffset? dateTo = null, Guid? currentUserId = null, string? currentUserRole = null, CancellationToken cancellationToken = default);
    Task<DashboardTrendsDto> GetTrendsAsync(DateTimeOffset? dateFrom = null, DateTimeOffset? dateTo = null, string interval = "day", CancellationToken cancellationToken = default);
}

public class DashboardService : IDashboardService
{
    private readonly IApplicationDbContext _context;

    public DashboardService(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<DashboardSummaryDto> GetSummaryAsync(DateTimeOffset? dateFrom = null, DateTimeOffset? dateTo = null, Guid? currentUserId = null, string? currentUserRole = null, CancellationToken cancellationToken = default)
    {
        var txnQuery = _context.Transactions.AsNoTracking().AsQueryable();
        var excQuery = _context.Exceptions.AsNoTracking().AsQueryable();

        if (dateFrom.HasValue)
        {
            var utcFrom = dateFrom.Value.ToUniversalTime();
            txnQuery = txnQuery.Where(t => t.TransactionDate >= utcFrom);
            excQuery = excQuery.Where(e => e.CreatedAt >= utcFrom);
        }

        if (dateTo.HasValue)
        {
            var utcTo = dateTo.Value.ToUniversalTime();
            txnQuery = txnQuery.Where(t => t.TransactionDate <= utcTo);
            excQuery = excQuery.Where(e => e.CreatedAt <= utcTo);
        }

        // Role scoping for analyst
        if (currentUserRole == UserRole.Analyst && currentUserId.HasValue)
        {
            excQuery = excQuery.Where(e => e.AssignedTo == currentUserId.Value || e.AssignedTo == null);
        }

        var totalTxns = await txnQuery.CountAsync(cancellationToken);
        var matchedTxns = await txnQuery.CountAsync(t => t.Status == TransactionStatus.Matched, cancellationToken);
        var unmatchedTxns = await txnQuery.CountAsync(t => t.Status != TransactionStatus.Matched, cancellationToken);

        var openExceptions = await excQuery.CountAsync(e => e.Status == ExceptionStatus.Open || e.Status == ExceptionStatus.InProgress, cancellationToken);
        var resolvedExceptions = await excQuery.CountAsync(e => e.Status == ExceptionStatus.Resolved, cancellationToken);

        decimal matchRate = totalTxns > 0 ? Math.Round(((decimal)matchedTxns / totalTxns) * 100m, 1) : 0m;

        return new DashboardSummaryDto
        {
            TotalTransactions = totalTxns,
            MatchedTransactions = matchedTxns,
            UnmatchedTransactions = unmatchedTxns,
            OpenExceptions = openExceptions,
            ResolvedExceptions = resolvedExceptions,
            MatchRate = matchRate
        };
    }

    public async Task<DashboardTrendsDto> GetTrendsAsync(DateTimeOffset? dateFrom = null, DateTimeOffset? dateTo = null, string interval = "day", CancellationToken cancellationToken = default)
    {
        var from = (dateFrom ?? DateTimeOffset.UtcNow.AddDays(-14)).ToUniversalTime();
        var to = (dateTo ?? DateTimeOffset.UtcNow).ToUniversalTime();

        var runs = await _context.ReconciliationRuns.AsNoTracking()
            .Where(r => r.StartedAt >= from && r.StartedAt <= to && r.Status == ReconciliationRunStatus.Completed)
            .OrderBy(r => r.StartedAt)
            .ToListAsync(cancellationToken);

        var runIds = runs.Select(r => r.Id).ToList();
        var matchItemsByRun = await _context.ReconciliationMatchItems.AsNoTracking()
            .Where(mi => mi.ReconciliationMatch != null && runIds.Contains(mi.ReconciliationMatch.ReconciliationRunId))
            .Select(mi => new { mi.ReconciliationMatch!.ReconciliationRunId, mi.TransactionId })
            .ToListAsync(cancellationToken);

        var matchedCountLookup = matchItemsByRun
            .GroupBy(x => x.ReconciliationRunId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.TransactionId).Distinct().Count());

        var grouped = runs.GroupBy(r => r.StartedAt.ToString("yyyy-MM-dd"))
            .Select(g =>
            {
                var tot = g.Sum(r => r.TotalInternal + r.TotalExternal);
                var mat = g.Sum(r => matchedCountLookup.TryGetValue(r.Id, out var c) && c > 0 ? c : r.MatchedCount * 2);
                var exc = g.Sum(r => r.ExceptionCount);
                var rate = tot > 0 ? Math.Round(((decimal)mat / tot) * 100m, 1) : 0m;
                return new DashboardTrendItem
                {
                    Period = g.Key,
                    Total = tot,
                    Matched = mat,
                    Exceptions = exc,
                    MatchRate = rate
                };
            }).ToList();

        return new DashboardTrendsDto
        {
            Interval = interval,
            Items = grouped
        };
    }
}
