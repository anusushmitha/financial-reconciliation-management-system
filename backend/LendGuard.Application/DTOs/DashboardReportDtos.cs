using System;
using System.Collections.Generic;

namespace LendGuard.Application.DTOs;

public class DashboardSummaryDto
{
    public int TotalTransactions { get; set; }
    public int MatchedTransactions { get; set; }
    public int UnmatchedTransactions { get; set; }
    public int OpenExceptions { get; set; }
    public int ResolvedExceptions { get; set; }
    public decimal MatchRate { get; set; }
}

public class DashboardTrendItem
{
    public string Period { get; set; } = string.Empty;
    public int Total { get; set; }
    public int Matched { get; set; }
    public int Exceptions { get; set; }
    public decimal MatchRate { get; set; }
}

public class DashboardTrendsDto
{
    public string Interval { get; set; } = "day";
    public List<DashboardTrendItem> Items { get; set; } = new();
}

public class ReconciliationReportTotals
{
    public int Runs { get; set; }
    public int InternalTransactions { get; set; }
    public int ExternalTransactions { get; set; }
    public int Matched { get; set; }
    public int Exceptions { get; set; }
}

public class ReconciliationReportDto
{
    public Dictionary<string, string?> Filters { get; set; } = new();
    public ReconciliationReportTotals Totals { get; set; } = new();
    public decimal MatchRate { get; set; }
}

public class ExceptionReportTotals
{
    public int Total { get; set; }
    public int Low { get; set; }
    public int Medium { get; set; }
    public int High { get; set; }
    public int Critical { get; set; }
}

public class ExceptionTypeCount
{
    public string Type { get; set; } = string.Empty;
    public int Count { get; set; }
}

public class ExceptionReportDto
{
    public Dictionary<string, string?> Filters { get; set; } = new();
    public ExceptionReportTotals Totals { get; set; } = new();
    public List<ExceptionTypeCount> ByType { get; set; } = new();
}

public class AuditLogDto
{
    public Guid Id { get; set; }
    public Guid? UserId { get; set; }
    public string? ActorName { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public Guid? EntityId { get; set; }
    public object? Details { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
