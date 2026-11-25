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

public class UpdatePolicyRequest
{
    public string ProfileId { get; set; } = "balanced";
    public decimal AmountTolerancePercent { get; set; }
    public decimal FixedRupeeTolerance { get; set; }
    public int DateSlippageDays { get; set; }
    public bool FuzzyReferenceMatching { get; set; } = true;
    public int FuzzyThreshold { get; set; } = 85;
    public int AutoReconConfidence { get; set; } = 95;
    public decimal IsolationForestOutlierThreshold { get; set; } = 0.75m;
    public bool MultiCurrencyHandling { get; set; } = true;
}

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

    [HttpGet("policy")]
    public async Task<IActionResult> GetActivePolicy(CancellationToken cancellationToken)
    {
        var policy = await _context.ReconciliationPolicies
            .AsNoTracking()
            .OrderByDescending(p => p.UpdatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (policy == null)
        {
            policy = new ReconciliationPolicy
            {
                Id = Guid.NewGuid(),
                ProfileId = "strict",
                AmountTolerancePercent = 0.00m,
                FixedRupeeTolerance = 0.00m,
                DateSlippageDays = 0,
                FuzzyReferenceMatching = true,
                FuzzyThreshold = 85,
                AutoReconConfidence = 95,
                IsolationForestOutlierThreshold = 0.75m,
                MultiCurrencyHandling = true,
                UpdatedAt = DateTimeOffset.UtcNow
            };
        }

        return Ok(new
        {
            selectedPreset = policy.ProfileId,
            amountTolerancePercent = policy.AmountTolerancePercent,
            fixedRupeeTolerance = policy.FixedRupeeTolerance,
            dateSlippageDays = policy.DateSlippageDays,
            fuzzyReferenceMatching = policy.FuzzyReferenceMatching,
            fuzzyThreshold = policy.FuzzyThreshold,
            autoReconConfidence = policy.AutoReconConfidence,
            isolationForestOutlierThreshold = policy.IsolationForestOutlierThreshold,
            multiCurrencyHandling = policy.MultiCurrencyHandling,
            updatedAt = policy.UpdatedAt
        });
    }

    [HttpPut("policy")]
    [Authorize(Roles = UserRole.Admin)]
    public async Task<IActionResult> UpdateActivePolicy([FromBody] UpdatePolicyRequest request, CancellationToken cancellationToken)
    {
        if (request.AmountTolerancePercent < 0m || request.AmountTolerancePercent > 5.0m)
        {
            throw new ArgumentException("Percentage tolerance must be between 0% and 5%.");
        }
        if (request.FixedRupeeTolerance < 0m || request.FixedRupeeTolerance > 1000m)
        {
            throw new ArgumentException("Fixed cap tolerance must be between 0 and 1000.");
        }
        if (request.DateSlippageDays < 0 || request.DateSlippageDays > 14)
        {
            throw new ArgumentException("Date slippage days must be between 0 and 14.");
        }

        var existing = await _context.ReconciliationPolicies
            .OrderByDescending(p => p.UpdatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (existing == null)
        {
            existing = new ReconciliationPolicy { Id = Guid.NewGuid() };
            _context.ReconciliationPolicies.Add(existing);
        }

        existing.ProfileId = string.IsNullOrWhiteSpace(request.ProfileId) ? "custom" : request.ProfileId.Trim().ToLowerInvariant();
        existing.AmountTolerancePercent = request.AmountTolerancePercent;
        existing.FixedRupeeTolerance = request.FixedRupeeTolerance;
        existing.DateSlippageDays = request.DateSlippageDays;
        existing.FuzzyReferenceMatching = request.FuzzyReferenceMatching;
        existing.FuzzyThreshold = request.FuzzyThreshold;
        existing.AutoReconConfidence = request.AutoReconConfidence;
        existing.IsolationForestOutlierThreshold = request.IsolationForestOutlierThreshold;
        existing.MultiCurrencyHandling = request.MultiCurrencyHandling;
        existing.UpdatedBy = CurrentUserId;
        existing.UpdatedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync("POLICY_UPDATED", "SYSTEM_POLICY", existing.Id, CurrentUserId, new
        {
            profileId = existing.ProfileId,
            amountTolerancePercent = existing.AmountTolerancePercent,
            fixedRupeeTolerance = existing.FixedRupeeTolerance,
            dateSlippageDays = existing.DateSlippageDays,
            isolationForestOutlierThreshold = existing.IsolationForestOutlierThreshold
        }, null, cancellationToken);

        await _notificationService.BroadcastEventAsync("POLICY_UPDATED", "Matching Policy Updated", $"Rule profile set to '{existing.ProfileId}' (±{existing.AmountTolerancePercent:0.##}% / ±{existing.DateSlippageDays}d).", new { profileId = existing.ProfileId }, cancellationToken);

        return Ok(new
        {
            success = true,
            selectedPreset = existing.ProfileId,
            amountTolerancePercent = existing.AmountTolerancePercent,
            fixedRupeeTolerance = existing.FixedRupeeTolerance,
            dateSlippageDays = existing.DateSlippageDays,
            fuzzyReferenceMatching = existing.FuzzyReferenceMatching,
            fuzzyThreshold = existing.FuzzyThreshold,
            autoReconConfidence = existing.AutoReconConfidence,
            isolationForestOutlierThreshold = existing.IsolationForestOutlierThreshold,
            multiCurrencyHandling = existing.MultiCurrencyHandling,
            updatedAt = existing.UpdatedAt
        });
    }

    [HttpPost("demo-seed")]
    [Authorize(Roles = UserRole.Admin)]
    public async Task<IActionResult> ResetShowcaseDemo(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Admin requested full mathematically consistent showcase demonstration reset.");

        var summary = await DatabaseSeeder.ResetShowcaseDatasetAsync(_context, _logger, CurrentUserId, cancellationToken);

        await _auditService.LogAsync("SHOWCASE_DATA_RESET", "SYSTEM", Guid.Empty, CurrentUserId, new
        {
            totalTransactions = summary.TotalTransactions,
            matchedTransactions = summary.MatchedTransactions,
            totalExceptions = summary.TotalExceptions,
            assignedToAnu = summary.AssignedToAnu,
            assignedToOperationalAnalyst = summary.AssignedToOperationalAnalyst,
            unassignedOutliers = summary.UnassignedOpen
        }, null, cancellationToken);

        await _notificationService.BroadcastEventAsync("SYSTEM_RESEEDED", "Showcase State Reset", "Platform dataset rebuilt to mathematically verified demonstration benchmark.", null, cancellationToken);

        return Ok(new
        {
            success = true,
            message = "Showcase dataset cleanly rebuilt with verified accounting invariants.",
            resetCount = summary.TotalExceptions,
            totalTransactions = summary.TotalTransactions,
            matchedTransactions = summary.MatchedTransactions,
            openExceptions = summary.OpenExceptions,
            resolvedExceptions = summary.ResolvedExceptions,
            assignedToAnu = summary.AssignedToAnu,
            assignedToOperationalAnalyst = summary.AssignedToOperationalAnalyst,
            unassignedOutliers = summary.UnassignedOpen
        });
    }
}
