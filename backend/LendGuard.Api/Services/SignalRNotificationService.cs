using System;
using System.Threading;
using System.Threading.Tasks;
using LendGuard.Api.Hubs;
using LendGuard.Application.Common.Interfaces;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace LendGuard.Api.Services;

public class SignalRNotificationService : INotificationService
{
    private readonly IHubContext<LendGuardHub> _hubContext;
    private readonly ILogger<SignalRNotificationService> _logger;

    public SignalRNotificationService(IHubContext<LendGuardHub> hubContext, ILogger<SignalRNotificationService> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
    }

    public async Task BroadcastEventAsync(string eventType, string title, string message, object? data = null, CancellationToken cancellationToken = default)
    {
        try
        {
            var payload = new
            {
                id = Guid.NewGuid(),
                eventType,
                title,
                message,
                data,
                timestamp = DateTimeOffset.UtcNow
            };

            await _hubContext.Clients.All.SendAsync("ReceiveNotification", payload, cancellationToken);
            _logger.LogInformation("Real-time event broadcasted: {EventType} - {Title}", eventType, title);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to broadcast real-time SignalR event {EventType}", eventType);
        }
    }

    public async Task NotifyUserAsync(Guid userId, string eventType, string title, string message, object? data = null, CancellationToken cancellationToken = default)
    {
        try
        {
            var payload = new
            {
                id = Guid.NewGuid(),
                eventType,
                title,
                message,
                data,
                timestamp = DateTimeOffset.UtcNow
            };

            await _hubContext.Clients.Group($"user_{userId}").SendAsync("ReceiveNotification", payload, cancellationToken);
            _logger.LogInformation("User real-time event sent to {UserId}: {EventType}", userId, eventType);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send real-time SignalR event to user {UserId}", userId);
        }
    }
}
