using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace LendGuard.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TransactionsController : ControllerBase
    {
        private readonly LendGuardContext _context;

        public TransactionsController(LendGuardContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetTransactions(
            [FromQuery] string? search,
            [FromQuery] string? sourceSystem,
            [FromQuery] string? reconciliationStatus,
            [FromQuery] DateTime? startDate,
            [FromQuery] DateTime? endDate,
            [FromQuery] decimal? minAmount,
            [FromQuery] decimal? maxAmount,
            [FromQuery] string? sortBy = "date",
            [FromQuery] string? sortOrder = "desc",
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            var query = _context.Transactions.AsNoTracking().AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                search = search.Trim().ToLower();
                query = query.Where(t => t.ReferenceId.ToLower().Contains(search) 
                                      || t.Type.ToLower().Contains(search)
                                      || t.Status.ToLower().Contains(search));
            }

            if (!string.IsNullOrWhiteSpace(sourceSystem) && sourceSystem != "All")
            {
                query = query.Where(t => t.SourceSystem == sourceSystem);
            }

            if (!string.IsNullOrWhiteSpace(reconciliationStatus) && reconciliationStatus != "All")
            {
                query = query.Where(t => t.ReconciliationStatus == reconciliationStatus);
            }

            if (startDate.HasValue)
            {
                query = query.Where(t => t.TransactionDate >= startDate.Value);
            }

            if (endDate.HasValue)
            {
                query = query.Where(t => t.TransactionDate <= endDate.Value);
            }

            if (minAmount.HasValue)
            {
                query = query.Where(t => t.Amount >= minAmount.Value);
            }

            if (maxAmount.HasValue)
            {
                query = query.Where(t => t.Amount <= maxAmount.Value);
            }

            // Sorting
            query = (sortBy?.ToLower(), sortOrder?.ToLower()) switch
            {
                ("amount", "asc") => query.OrderBy(t => t.Amount),
                ("amount", "desc") => query.OrderByDescending(t => t.Amount),
                ("reference", "asc") => query.OrderBy(t => t.ReferenceId),
                ("reference", "desc") => query.OrderByDescending(t => t.ReferenceId),
                ("status", "asc") => query.OrderBy(t => t.ReconciliationStatus),
                ("status", "desc") => query.OrderByDescending(t => t.ReconciliationStatus),
                ("date", "asc") => query.OrderBy(t => t.TransactionDate),
                _ => query.OrderByDescending(t => t.TransactionDate)
            };

            var totalCount = await query.CountAsync();
            var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

            return Ok(new
            {
                totalCount,
                page,
                pageSize,
                totalPages = (int)Math.Ceiling(totalCount / (double)pageSize),
                data = items
            });
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetTransactionDetail(int id)
        {
            var tx = await _context.Transactions.FindAsync(id);
            if (tx == null) return NotFound(new { message = $"Transaction #{id} not found." });

            // Find matching counterpart in other source system
            var oppositeSystem = tx.SourceSystem == "Internal" ? "External" : "Internal";
            var counterpart = await _context.Transactions
                .Where(t => t.ReferenceId == tx.ReferenceId && t.SourceSystem == oppositeSystem)
                .FirstOrDefaultAsync();

            var relatedExceptions = await _context.Exceptions
                .Where(e => e.TransactionReference == tx.ReferenceId)
                .ToListAsync();

            return Ok(new
            {
                transaction = tx,
                counterpart = counterpart,
                relatedExceptions = relatedExceptions
            });
        }

        [HttpGet("duplicates")]
        public async Task<IActionResult> GetDuplicateTransactions()
        {
            var duplicates = await _context.Transactions
                .GroupBy(t => new { t.ReferenceId, t.SourceSystem })
                .Where(g => g.Count() > 1)
                .Select(g => new
                {
                    g.Key.ReferenceId,
                    g.Key.SourceSystem,
                    Count = g.Count(),
                    Transactions = g.ToList()
                })
                .ToListAsync();

            return Ok(duplicates);
        }
    }
}
