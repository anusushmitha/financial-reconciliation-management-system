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
[Route("api/v1/transactions")]
[Authorize]
public class TransactionsController : ApiControllerBase
{
    private readonly ITransactionService _transactionService;

    public TransactionsController(ITransactionService transactionService)
    {
        _transactionService = transactionService;
    }

    [HttpGet]
    public async Task<ActionResult<PaginatedList<TransactionSummaryDto>>> GetTransactions(
        [FromQuery] TransactionFilterParams filters,
        CancellationToken cancellationToken)
    {
        var result = await _transactionService.GetTransactionsAsync(filters, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<TransactionDetailDto>> GetTransactionById(Guid id, CancellationToken cancellationToken)
    {
        var result = await _transactionService.GetTransactionByIdAsync(id, cancellationToken);
        return Ok(result);
    }
}
