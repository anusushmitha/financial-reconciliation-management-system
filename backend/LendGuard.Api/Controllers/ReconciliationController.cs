using System;
using System.Threading;
using System.Threading.Tasks;
using LendGuard.Application.Common.Models;
using LendGuard.Application.DTOs;
using LendGuard.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LendGuard.Api.Controllers;

[ApiController]
[Route("api/v1/reconciliation-runs")]
[Authorize]
public class ReconciliationController : ApiControllerBase
{
    private readonly IReconciliationService _reconciliationService;

    public ReconciliationController(IReconciliationService reconciliationService)
    {
        _reconciliationService = reconciliationService;
    }

    [HttpPost]
    public async Task<ActionResult<StartReconciliationResponse>> StartReconciliation(
        [FromBody] StartReconciliationRequest request,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey,
        CancellationToken cancellationToken)
    {
        var result = await _reconciliationService.QueueReconciliationAsync(request, CurrentUserId, cancellationToken);
        return Accepted(result);
    }

    [HttpGet]
    public async Task<ActionResult<PaginatedList<ReconciliationRunSummaryDto>>> GetRuns(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? status = null,
        CancellationToken cancellationToken = default)
    {
        var result = await _reconciliationService.GetRunsAsync(page, pageSize, status, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ReconciliationRunDetailDto>> GetRunById(Guid id, CancellationToken cancellationToken)
    {
        var result = await _reconciliationService.GetRunByIdAsync(id, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id}/matches")]
    public async Task<ActionResult<PaginatedList<MatchItemDto>>> GetRunMatches(
        Guid id,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var result = await _reconciliationService.GetRunMatchesAsync(id, page, pageSize, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id}/exceptions")]
    public async Task<ActionResult<PaginatedList<ExceptionSummaryDto>>> GetRunExceptions(
        Guid id,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var result = await _reconciliationService.GetRunExceptionsAsync(id, page, pageSize, cancellationToken);
        return Ok(result);
    }
}
