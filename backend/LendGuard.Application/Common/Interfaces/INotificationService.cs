using System;
using System.Threading;
using System.Threading.Tasks;

namespace LendGuard.Application.Common.Interfaces;

public interface INotificationService
{
    Task BroadcastEventAsync(string eventType, string title, string message, object? data = null, CancellationToken cancellationToken = default);
    Task NotifyUserAsync(Guid userId, string eventType, string title, string message, object? data = null, CancellationToken cancellationToken = default);
}
