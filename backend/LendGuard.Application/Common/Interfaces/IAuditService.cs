using System;
using System.Threading;
using System.Threading.Tasks;

namespace LendGuard.Application.Common.Interfaces;

public interface IAuditService
{
    Task LogAsync(string action, string entityType, Guid? entityId, Guid? userId, object? details = null, Guid? correlationId = null, CancellationToken cancellationToken = default);
}
