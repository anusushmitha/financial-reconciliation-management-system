using System;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using LendGuard.Application.Common.Interfaces;
using LendGuard.Application.Common.Models;
using LendGuard.Application.DTOs;
using Microsoft.EntityFrameworkCore;

namespace LendGuard.Application.Services;

public interface IAuditLogService
{
    Task<PaginatedList<AuditLogDto>> GetAuditLogsAsync(int page = 1, int pageSize = 20, string? actor = null, string? action = null, string? entityType = null, DateTimeOffset? from = null, DateTimeOffset? to = null, CancellationToken cancellationToken = default);
}

public class AuditLogService : IAuditLogService
{
    private readonly IApplicationDbContext _context;

    public AuditLogService(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<PaginatedList<AuditLogDto>> GetAuditLogsAsync(int page = 1, int pageSize = 20, string? actor = null, string? action = null, string? entityType = null, DateTimeOffset? from = null, DateTimeOffset? to = null, CancellationToken cancellationToken = default)
    {
        var query = _context.AuditLogs.AsNoTracking()
            .Include(a => a.User)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(actor))
        {
            var act = actor.Trim().ToLower();
            query = query.Where(a => a.User != null && (a.User.FullName.ToLower().Contains(act) || a.User.Email.ToLower().Contains(act)));
        }

        if (!string.IsNullOrWhiteSpace(action))
        {
            query = query.Where(a => a.Action == action.Trim().ToUpper());
        }

        if (!string.IsNullOrWhiteSpace(entityType))
        {
            query = query.Where(a => a.EntityType == entityType.Trim().ToUpper());
        }

        if (from.HasValue) query = query.Where(a => a.CreatedAt >= from.Value);
        if (to.HasValue) query = query.Where(a => a.CreatedAt <= to.Value);

        var total = await query.CountAsync(cancellationToken);
        var logs = await query.OrderByDescending(a => a.CreatedAt)
                              .Skip((page - 1) * pageSize)
                              .Take(pageSize)
                              .ToListAsync(cancellationToken);

        var items = logs.Select(a =>
        {
            object? detailsObj = null;
            if (!string.IsNullOrWhiteSpace(a.Details))
            {
                try { detailsObj = JsonSerializer.Deserialize<object>(a.Details); } catch { detailsObj = a.Details; }
            }

            return new AuditLogDto
            {
                Id = a.Id,
                UserId = a.UserId,
                ActorName = a.User?.FullName ?? "System",
                Action = a.Action,
                EntityType = a.EntityType,
                EntityId = a.EntityId,
                Details = detailsObj,
                CreatedAt = a.CreatedAt
            };
        }).ToList();

        return new PaginatedList<AuditLogDto>(items, total, page, pageSize);
    }
}
