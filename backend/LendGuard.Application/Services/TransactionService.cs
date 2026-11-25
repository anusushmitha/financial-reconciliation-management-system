using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using LendGuard.Application.Common.Interfaces;
using LendGuard.Application.Common.Models;
using LendGuard.Application.DTOs;
using Microsoft.EntityFrameworkCore;

namespace LendGuard.Application.Services;

public interface ITransactionService
{
    Task<PaginatedList<TransactionSummaryDto>> GetTransactionsAsync(TransactionFilterParams filters, CancellationToken cancellationToken = default);
    Task<TransactionDetailDto> GetTransactionByIdAsync(Guid id, CancellationToken cancellationToken = default);
}

public class TransactionService : ITransactionService
{
    private readonly IApplicationDbContext _context;

    public TransactionService(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<PaginatedList<TransactionSummaryDto>> GetTransactionsAsync(TransactionFilterParams filters, CancellationToken cancellationToken = default)
    {
        var query = _context.Transactions.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(filters.Search))
        {
            var s = filters.Search.Trim().ToLower();
            query = query.Where(t => t.TransactionReference.ToLower().Contains(s) || (t.ExternalReference != null && t.ExternalReference.ToLower().Contains(s)));
        }

        if (!string.IsNullOrWhiteSpace(filters.SourceType))
        {
            query = query.Where(t => t.SourceType == filters.SourceType.Trim().ToUpper());
        }

        if (!string.IsNullOrWhiteSpace(filters.Status))
        {
            query = query.Where(t => t.Status == filters.Status.Trim().ToUpper());
        }

        if (filters.From.HasValue)
        {
            query = query.Where(t => t.TransactionDate >= filters.From.Value);
        }

        if (filters.To.HasValue)
        {
            query = query.Where(t => t.TransactionDate <= filters.To.Value);
        }

        var total = await query.CountAsync(cancellationToken);
        var items = await query.OrderByDescending(t => t.TransactionDate)
                               .Skip((filters.Page - 1) * filters.PageSize)
                               .Take(filters.PageSize)
                               .Select(t => new TransactionSummaryDto
                               {
                                   Id = t.Id,
                                   TransactionReference = t.TransactionReference,
                                   ExternalReference = t.ExternalReference,
                                   TransactionDate = t.TransactionDate,
                                   Amount = t.Amount,
                                   Currency = t.Currency,
                                   TransactionType = t.TransactionType,
                                   SourceType = t.SourceType,
                                   Status = t.Status,
                                   ImportBatchId = t.ImportBatchId
                               })
                               .ToListAsync(cancellationToken);

        return new PaginatedList<TransactionSummaryDto>(items, total, filters.Page, filters.PageSize);
    }

    public async Task<TransactionDetailDto> GetTransactionByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var txn = await _context.Transactions.AsNoTracking()
            .Include(t => t.ImportBatch)
            .FirstOrDefaultAsync(t => t.Id == id, cancellationToken);

        if (txn == null)
        {
            throw new KeyNotFoundException("Transaction not found.");
        }

        var relatedMatches = await _context.ReconciliationMatchItems.AsNoTracking()
            .Where(m => m.TransactionId == id)
            .Select(m => m.ReconciliationMatchId)
            .Distinct()
            .ToListAsync(cancellationToken);

        var relatedExceptions = await _context.Exceptions.AsNoTracking()
            .Where(e => e.InternalTransactionId == id || e.ExternalTransactionId == id)
            .Select(e => e.Id)
            .Distinct()
            .ToListAsync(cancellationToken);

        return new TransactionDetailDto
        {
            Id = txn.Id,
            TransactionReference = txn.TransactionReference,
            ExternalReference = txn.ExternalReference,
            TransactionDate = txn.TransactionDate,
            Amount = txn.Amount,
            Currency = txn.Currency,
            TransactionType = txn.TransactionType,
            SourceType = txn.SourceType,
            Status = txn.Status,
            ImportBatchId = txn.ImportBatchId,
            BatchReference = txn.ImportBatch?.BatchReference,
            RawData = txn.RawData,
            RelatedMatchIds = relatedMatches,
            RelatedExceptionIds = relatedExceptions
        };
    }
}
