using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using LendGuard.Application.Common.Interfaces;
using LendGuard.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace LendGuard.Infrastructure.Services;

public class AuditService : IAuditService
{
    private readonly IApplicationDbContext _context;
    private readonly ILogger<AuditService> _logger;

    public AuditService(IApplicationDbContext context, ILogger<AuditService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task LogAsync(string action, string entityType, Guid? entityId, Guid? userId, object? details = null, Guid? correlationId = null, CancellationToken cancellationToken = default)
    {
        try
        {
            var auditLog = new AuditLog
            {
                Id = Guid.NewGuid(),
                Action = action,
                EntityType = entityType,
                EntityId = entityId,
                UserId = userId,
                CorrelationId = correlationId,
                Details = details != null ? JsonSerializer.Serialize(details) : "{}",
                CreatedAt = DateTimeOffset.UtcNow
            };

            _context.AuditLogs.Add(auditLog);
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            // Audit failures should not crash user operation, but must be logged
            _logger.LogError(ex, "Failed to persist audit log for Action: {Action}, EntityType: {EntityType}, EntityId: {EntityId}", action, entityType, entityId);
        }
    }
}
