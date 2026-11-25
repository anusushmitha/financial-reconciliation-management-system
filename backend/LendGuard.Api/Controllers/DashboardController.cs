using System;
using System.Threading;
using System.Threading.Tasks;
using LendGuard.Application.DTOs;
using LendGuard.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LendGuard.Api.Controllers;

[ApiController]
[Route("api/v1/dashboard")]
[Authorize]
public class DashboardController : ApiControllerBase
{
    private readonly IDashboardService _dashboardService;

    public DashboardController(IDashboardService dashboardService)
    {
        _dashboardService = dashboardService;
    }

    [HttpGet("summary")]
    public async Task<ActionResult<DashboardSummaryDto>> GetSummary(
        [FromQuery] DateTimeOffset? dateFrom,
        [FromQuery] DateTimeOffset? dateTo,
        CancellationToken cancellationToken)
    {
        var result = await _dashboardService.GetSummaryAsync(dateFrom, dateTo, CurrentUserId, CurrentUserRole, cancellationToken);
        return Ok(result);
    }

    [HttpGet("trends")]
    public async Task<ActionResult<DashboardTrendsDto>> GetTrends(
        [FromQuery] DateTimeOffset? dateFrom,
        [FromQuery] DateTimeOffset? dateTo,
        [FromQuery] string interval = "day",
        CancellationToken cancellationToken = default)
    {
        var result = await _dashboardService.GetTrendsAsync(dateFrom, dateTo, interval, cancellationToken);
        return Ok(result);
    }
}
