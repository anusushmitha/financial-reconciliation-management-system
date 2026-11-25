using System;
using System.Threading;
using System.Threading.Tasks;
using LendGuard.Application.Common.Models;
using LendGuard.Application.DTOs;
using LendGuard.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace LendGuard.Api.Controllers;

[ApiController]
[Route("api/v1/imports")]
[Authorize]
public class ImportsController : ApiControllerBase
{
    private readonly IImportService _importService;

    public ImportsController(IImportService importService)
    {
        _importService = importService;
    }

    [HttpPost]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<UploadImportResponse>> Upload([FromForm] IFormFile file, [FromForm] string sourceType, CancellationToken cancellationToken)
    {
        if (file == null || file.Length == 0)
        {
            throw new ArgumentException("Please choose a valid non-empty CSV file.");
        }

        // 10MB limit guardrail
        if (file.Length > 10 * 1024 * 1024)
        {
            return StatusCode(StatusCodes.Status413PayloadTooLarge, new StandardErrorResponse
            {
                Error = new ErrorDetails { Code = "FILE_TOO_LARGE", Message = "Uploaded file exceeds maximum limit of 10 MB." }
            });
        }

        await using var stream = file.OpenReadStream();
        var result = await _importService.UploadFileAsync(stream, file.FileName, sourceType, CurrentUserId, cancellationToken);
        return Accepted(result);
    }

    [HttpGet]
    public async Task<ActionResult<PaginatedList<ImportBatchSummaryDto>>> GetBatches(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? sourceType = null,
        [FromQuery] string? status = null,
        CancellationToken cancellationToken = default)
    {
        var result = await _importService.GetBatchesAsync(page, pageSize, sourceType, status, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ImportBatchDetailDto>> GetBatchById(Guid id, CancellationToken cancellationToken)
    {
        var result = await _importService.GetBatchByIdAsync(id, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id}/validation")]
    public async Task<ActionResult<ValidationResultDto>> GetValidationResults(
        Guid id,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var result = await _importService.GetValidationResultsAsync(id, page, pageSize, cancellationToken);
        return Ok(result);
    }

    [HttpPost("{id}/confirm")]
    public async Task<ActionResult<ConfirmImportResponse>> ConfirmBatch(
        Guid id,
        [FromBody] ConfirmImportRequest request,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey,
        CancellationToken cancellationToken)
    {
        var result = await _importService.ConfirmBatchAsync(id, request.ConfirmValidRows, CurrentUserId, cancellationToken);
        return Ok(result);
    }
}
