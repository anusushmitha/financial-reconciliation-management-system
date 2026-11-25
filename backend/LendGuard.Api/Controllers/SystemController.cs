using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using LendGuard.Application.Common.Interfaces;
using LendGuard.Domain;
using LendGuard.Domain.Entities;
using LendGuard.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace LendGuard.Api.Controllers;

[ApiController]
[Route("api/v1/system")]
[Authorize]
public class SystemController : ApiControllerBase
{
    private readonly LendGuardDbContext _context;
    private readonly IAuditService _auditService;
    private readonly INotificationService _notificationService;
    private readonly ILogger<SystemController> _logger;

    public SystemController(
        LendGuardDbContext context,
        IAuditService auditService,
        INotificationService notificationService,
        ILogger<SystemController> logger)
    {
        _context = context;
        _auditService = auditService;
        _notificationService = notificationService;
        _logger = logger;
    }

    [HttpPost("demo-seed")]
    [Authorize(Roles = UserRole.Admin)]
    public async Task<IActionResult> ResetShowcaseDemo(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Admin requested showcase demonstration reset.");

        // 1. Fetch Key Users
        var anu = await _context.Users.FirstOrDefaultAsync(u => u.Email == "sanushusmitha@gmail.com", cancellationToken);
        var op = await _context.Users.FirstOrDefaultAsync(u => u.Email == "staging.analyst@lendguard.internal", cancellationToken);

        // 2. Curate 5 flagship showcase exceptions with varied severities and realistic discrepancy types
        var exceptions = await _context.Exceptions
            .OrderBy(e => e.CreatedAt)
            .Take(10)
            .ToListAsync(cancellationToken);

        int index = 0;
        foreach (var ex in exceptions)
        {
            if (index == 0 && anu != null)
            {
                ex.AssignedTo = anu.Id;
                ex.Status = ExceptionStatus.InProgress;
                ex.Severity = "CRITICAL";
                ex.ExceptionType = "AMOUNT_MISMATCH";
                ex.DiscrepancyAmount = 15420.50m;
            }
            else if (index == 1 && anu != null)
            {
                ex.AssignedTo = anu.Id;
                ex.Status = ExceptionStatus.InProgress;
                ex.Severity = "HIGH";
                ex.ExceptionType = "MISSING_SETTLEMENT";
                ex.DiscrepancyAmount = 8500.00m;
            }
            else if (index == 2 && op != null)
            {
                ex.AssignedTo = op.Id;
                ex.Status = ExceptionStatus.InProgress;
                ex.Severity = "HIGH";
                ex.ExceptionType = "UNMATCHED_EXTERNAL";
                ex.DiscrepancyAmount = 5200.00m;
            }
            else if (index == 3 && op != null)
            {
                ex.AssignedTo = op.Id;
                ex.Status = ExceptionStatus.InProgress;
                ex.Severity = "MEDIUM";
                ex.ExceptionType = "PARTIAL_SETTLEMENT";
                ex.DiscrepancyAmount = 1250.00m;
            }
            else if (index == 4)
            {
                // Showcase Unassigned Outlier
                ex.AssignedTo = null;
                ex.Status = ExceptionStatus.Open;
                ex.Severity = "CRITICAL";
                ex.ExceptionType = "AMBIGUOUS_MATCH";
                ex.DiscrepancyAmount = 45000.00m;
            }
            else
            {
                ex.Status = ExceptionStatus.Open;
                ex.AssignedTo = null;
            }

            ex.UpdatedAt = DateTimeOffset.UtcNow;
            index++;
        }

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync("SHOWCASE_DATA_RESET", "SYSTEM", Guid.Empty, CurrentUserId, new { resetCount = exceptions.Count }, null, cancellationToken);

        await _notificationService.BroadcastEventAsync("SYSTEM_RESEEDED", "Showcase State Reset", "Platform data has been refreshed to pristine demonstration benchmark.", null, cancellationToken);

        return Ok(new
        {
            success = true,
            message = "Showcase dataset successfully restored.",
            resetCount = exceptions.Count,
            assignedToAnu = 2,
            assignedToOperationalAnalyst = 2,
            unassignedOutliers = 1
        });
    }
}
