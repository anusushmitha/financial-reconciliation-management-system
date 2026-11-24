using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace LendGuard.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DashboardController : ControllerBase
    {
        private readonly LendGuardContext _context;

        public DashboardController(LendGuardContext context)
        {
            _context = context;
        }

        [HttpGet("metrics")]
        public async Task<IActionResult> GetDashboardMetrics(
            [FromQuery] DateTime? startDate,
            [FromQuery] DateTime? endDate)
        {
            var txQuery = _context.Transactions.AsNoTracking().AsQueryable();
            var exQuery = _context.Exceptions.AsNoTracking().AsQueryable();

            if (startDate.HasValue)
            {
                txQuery = txQuery.Where(t => t.TransactionDate >= startDate.Value);
                exQuery = exQuery.Where(e => e.CreatedDate >= startDate.Value);
            }

            if (endDate.HasValue)
            {
                txQuery = txQuery.Where(t => t.TransactionDate <= endDate.Value);
                exQuery = exQuery.Where(e => e.CreatedDate <= endDate.Value);
            }

            int totalTransactions = await txQuery.CountAsync();
            int matchedTransactions = await txQuery.CountAsync(t => t.ReconciliationStatus == "Matched");
            int unmatchedTransactions = await txQuery.CountAsync(t => t.ReconciliationStatus == "Discrepancy" || t.ReconciliationStatus == "Pending");
            int duplicateTransactions = await txQuery.CountAsync(t => t.ReconciliationStatus == "Duplicate");

            int openExceptions = await exQuery.CountAsync(e => e.Status == "Open" || e.Status == "Assigned" || e.Status == "In Progress");
            int resolvedExceptions = await exQuery.CountAsync(e => e.Status == "Resolved" || e.Status == "Closed");
            int totalExceptions = await exQuery.CountAsync();

            decimal successRate = totalTransactions > 0 
                ? Math.Round(((decimal)matchedTransactions / totalTransactions) * 100m, 2)
                : 0.00m;

            // Exceptions by Type
            var exceptionsByType = await exQuery
                .GroupBy(e => e.ExceptionType)
                .Select(g => new { type = g.Key, count = g.Count() })
                .ToListAsync();

            // Exceptions by Severity
            var exceptionsBySeverity = await exQuery
                .GroupBy(e => e.Severity)
                .Select(g => new { severity = g.Key, count = g.Count() })
                .ToListAsync();

            // Matched vs Unmatched Distribution
            var statusDistribution = new[]
            {
                new { name = "Matched", value = matchedTransactions, color = "#10B981" },
                new { name = "Discrepancies", value = unmatchedTransactions, color = "#EF4444" },
                new { name = "Duplicates", value = duplicateTransactions, color = "#F59E0B" }
            };

            // Employee Workload Distribution
            var employeeWorkload = await _context.Users
                .Where(u => u.Role == "Operations Analyst")
                .Select(u => new
                {
                    employeeId = u.Id.ToString(),
                    name = u.FullName ?? u.Username,
                    assignedCount = _context.Exceptions.Count(e => (e.AssignedEmployeeId == u.Id.ToString() || e.AssignedEmployeeName == u.Username) && (e.Status == "Assigned" || e.Status == "In Progress")),
                    resolvedCount = _context.Exceptions.Count(e => (e.AssignedEmployeeId == u.Id.ToString() || e.AssignedEmployeeName == u.Username) && (e.Status == "Resolved" || e.Status == "Closed"))
                })
                .ToListAsync();

            // Recent Reconciliation Batches
            var recentBatches = await _context.ReconciliationBatches
                .OrderByDescending(b => b.ExecutedAt)
                .Take(5)
                .ToListAsync();

            return Ok(new
            {
                kpis = new
                {
                    totalTransactions,
                    matchedTransactions,
                    unmatchedTransactions,
                    openExceptions,
                    resolvedExceptions,
                    totalExceptions,
                    successRate
                },
                charts = new
                {
                    exceptionsByType,
                    exceptionsBySeverity,
                    statusDistribution,
                    employeeWorkload,
                    recentBatches
                }
            });
        }
    }
}
