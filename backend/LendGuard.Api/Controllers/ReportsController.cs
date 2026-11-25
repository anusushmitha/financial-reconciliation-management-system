using System;
using System.Threading;
using System.Threading.Tasks;
using LendGuard.Application.DTOs;
using LendGuard.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LendGuard.Api.Controllers;

[ApiController]
[Route("api/v1/reports")]
[Authorize]
public class ReportsController : ApiControllerBase
{
    private readonly IReportService _reportService;

    public ReportsController(IReportService reportService)
    {
        _reportService = reportService;
    }

    [HttpGet("reconciliation")]
    public async Task<ActionResult<ReconciliationReportDto>> GetReconciliationReport(
        [FromQuery] DateTimeOffset? dateFrom,
        [FromQuery] DateTimeOffset? dateTo,
        [FromQuery] string? status,
        [FromQuery] string? source,
        CancellationToken cancellationToken)
    {
        var result = await _reportService.GetReconciliationReportAsync(dateFrom, dateTo, status, source, cancellationToken);
        return Ok(result);
    }

    [HttpGet("exceptions")]
    public async Task<ActionResult<ExceptionReportDto>> GetExceptionReport(
        [FromQuery] DateTimeOffset? dateFrom,
        [FromQuery] DateTimeOffset? dateTo,
        [FromQuery] string? type,
        [FromQuery] string? severity,
        [FromQuery] string? status,
        CancellationToken cancellationToken)
    {
        var result = await _reportService.GetExceptionReportAsync(dateFrom, dateTo, type, severity, status, cancellationToken);
        return Ok(result);
    }

    [HttpGet("reconciliation/export")]
    public async Task<IActionResult> ExportReconciliationCsv(
        [FromQuery] DateTimeOffset? dateFrom,
        [FromQuery] DateTimeOffset? dateTo,
        [FromQuery] string? status,
        CancellationToken cancellationToken)
    {
        var bytes = await _reportService.ExportReconciliationCsvAsync(dateFrom, dateTo, status, cancellationToken);
        return File(bytes, "text/csv", $"reconciliation_report_{DateTime.UtcNow:yyyyMMdd_HHmmss}.csv");
    }

    [HttpGet("exceptions/export")]
    public async Task<IActionResult> ExportExceptionsCsv(
        [FromQuery] DateTimeOffset? dateFrom,
        [FromQuery] DateTimeOffset? dateTo,
        [FromQuery] string? type,
        [FromQuery] string? severity,
        [FromQuery] string? status,
        CancellationToken cancellationToken)
    {
        var bytes = await _reportService.ExportExceptionsCsvAsync(dateFrom, dateTo, type, severity, status, cancellationToken);
        return File(bytes, "text/csv", $"exceptions_report_{DateTime.UtcNow:yyyyMMdd_HHmmss}.csv");
    }
}
