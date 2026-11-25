using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using LendGuard.Application.Common.Models;
using LendGuard.Application.DTOs;
using LendGuard.Application.Services;
using LendGuard.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LendGuard.Api.Controllers;

[ApiController]
[Route("api/v1/exceptions")]
[Authorize]
public class ExceptionsController : ApiControllerBase
{
    private readonly IExceptionService _exceptionService;

    public ExceptionsController(IExceptionService exceptionService)
    {
        _exceptionService = exceptionService;
    }

    [HttpGet]
    public async Task<ActionResult<PaginatedList<ExceptionSummaryDto>>> GetExceptions(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? type = null,
        [FromQuery] string? severity = null,
        [FromQuery] string? status = null,
        [FromQuery] Guid? assignedTo = null,
        [FromQuery] bool? unassignedOnly = null,
        CancellationToken cancellationToken = default)
    {
        var result = await _exceptionService.GetExceptionsAsync(page, pageSize, type, severity, status, assignedTo, unassignedOnly, CurrentUserId, CurrentUserRole, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ExceptionDetailDto>> GetExceptionById(Guid id, CancellationToken cancellationToken)
    {
        var result = await _exceptionService.GetExceptionByIdAsync(id, CurrentUserId, CurrentUserRole, cancellationToken);
        return Ok(result);
    }

    [HttpPatch("{id}/assignment")]
    [Authorize(Roles = $"{UserRole.Admin},{UserRole.Analyst}")]
    public async Task<ActionResult<ExceptionDetailDto>> AssignException(Guid id, [FromBody] AssignExceptionRequest request, CancellationToken cancellationToken)
    {
        var result = await _exceptionService.AssignExceptionAsync(id, request, CurrentUserId, CurrentUserRole, cancellationToken);
        return Ok(result);
    }

    [HttpPost("batch-assignment")]
    [Authorize(Roles = $"{UserRole.Admin},{UserRole.Analyst}")]
    public async Task<ActionResult<BatchAssignExceptionsResponse>> BatchAssignExceptions([FromBody] BatchAssignExceptionsRequest request, CancellationToken cancellationToken)
    {
        var result = await _exceptionService.BatchAssignExceptionsAsync(request, CurrentUserId, CurrentUserRole, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id}/notes")]
    public async Task<ActionResult<List<InvestigationNoteDto>>> GetNotes(Guid id, CancellationToken cancellationToken)
    {
        var result = await _exceptionService.GetExceptionNotesAsync(id, cancellationToken);
        return Ok(result);
    }

    [HttpPost("{id}/notes")]
    public async Task<ActionResult<InvestigationNoteDto>> AddNote(Guid id, [FromBody] AddInvestigationNoteRequest request, CancellationToken cancellationToken)
    {
        var result = await _exceptionService.AddInvestigationNoteAsync(id, request, CurrentUserId, CurrentUserRole, cancellationToken);
        return Created($"/api/v1/exceptions/{id}/notes/{result.Id}", result);
    }

    [HttpPost("{id}/analysis")]
    public async Task<ActionResult<TriggerAiAnalysisResponse>> TriggerAnalysis(Guid id, [FromBody] TriggerAiAnalysisRequest request, CancellationToken cancellationToken)
    {
        var result = await _exceptionService.TriggerAiAnalysisAsync(id, request, CurrentUserId, CurrentUserRole, cancellationToken);
        return Accepted(result);
    }

    [HttpGet("{id}/analysis")]
    public async Task<ActionResult<List<AiAnalysisDto>>> GetAnalyses(Guid id, [FromQuery] bool latest = false, [FromQuery] string? type = null, CancellationToken cancellationToken = default)
    {
        var result = await _exceptionService.GetExceptionAnalysesAsync(id, latest, type, cancellationToken);
        return Ok(result);
    }

    [HttpPost("{id}/resolve")]
    public async Task<ActionResult<ExceptionDetailDto>> ResolveException(Guid id, [FromBody] ResolveExceptionRequest request, CancellationToken cancellationToken)
    {
        var result = await _exceptionService.ResolveExceptionAsync(id, request, CurrentUserId, CurrentUserRole, cancellationToken);
        return Ok(result);
    }
}
