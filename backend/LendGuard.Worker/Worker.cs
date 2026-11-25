using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using LendGuard.Application.Services;
using LendGuard.Domain;
using LendGuard.Domain.Entities;
using LendGuard.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LendGuard.Worker;

public class Worker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<Worker> _logger;
    private readonly string _workerId = $"worker-{Environment.MachineName}-{Guid.NewGuid():N}";

    public Worker(IServiceProvider serviceProvider, ILogger<Worker> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("LendGuard Background Worker Service started. Worker ID: {WorkerId}", _workerId);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var processed = await ProcessNextJobAsync(stoppingToken);
                if (!processed)
                {
                    // No pending jobs, wait for polling interval
                    await Task.Delay(TimeSpan.FromSeconds(3), stoppingToken);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred in worker processing loop.");
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }
    }

    private async Task<bool> ProcessNextJobAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<LendGuardDbContext>();

        // 1. Stuck-Job Recovery: Recover jobs locked for more than 5 minutes whose worker terminated
        var stuckJob = await context.BackgroundJobs
            .FromSqlRaw(@"SELECT * FROM background_jobs 
                          WHERE status = 'PROCESSING' 
                            AND locked_at <= (now() - interval '5 minutes')
                            AND attempts < max_attempts
                          ORDER BY created_at 
                          FOR UPDATE SKIP LOCKED 
                          LIMIT 1")
            .FirstOrDefaultAsync(cancellationToken);

        if (stuckJob != null)
        {
            _logger.LogWarning("Recovered stuck background job {JobId} (was locked by {LockedBy} at {LockedAt}). Re-queuing.", stuckJob.Id, stuckJob.LockedBy, stuckJob.LockedAt);
            stuckJob.Status = BackgroundJobStatus.Pending;
            stuckJob.AvailableAt = DateTimeOffset.UtcNow;
            await context.SaveChangesAsync(cancellationToken);
        }

        // 2. PostgreSQL SKIP LOCKED claim pattern:
        // SELECT id FROM background_jobs WHERE status = 'PENDING' AND available_at <= now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
        var job = await context.BackgroundJobs
            .FromSqlRaw(@"SELECT * FROM background_jobs 
                          WHERE status = 'PENDING' AND available_at <= now() 
                          ORDER BY created_at 
                          FOR UPDATE SKIP LOCKED 
                          LIMIT 1")
            .FirstOrDefaultAsync(cancellationToken);

        if (job == null)
        {
            return false;
        }

        job.Status = BackgroundJobStatus.Processing;
        job.LockedAt = DateTimeOffset.UtcNow;
        job.LockedBy = _workerId;
        job.Attempts++;
        await context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Claimed background job {JobId} of type {JobType} (attempt {Attempt}/{MaxAttempts})", job.Id, job.JobType, job.Attempts, job.MaxAttempts);

        try
        {
            if (job.JobType == BackgroundJobType.Reconciliation)
            {
                var reconService = scope.ServiceProvider.GetRequiredService<IReconciliationService>();
                var payloadDoc = JsonDocument.Parse(job.Payload);
                if (payloadDoc.RootElement.TryGetProperty("runId", out var runIdProp) && Guid.TryParse(runIdProp.GetString(), out var runId))
                {
                    await reconService.ExecuteReconciliationRunAsync(runId, cancellationToken);
                }
            }

            job.Status = BackgroundJobStatus.Completed;
            job.ProcessedAt = DateTimeOffset.UtcNow;
            await context.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("Successfully completed background job {JobId}", job.Id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to execute background job {JobId}", job.Id);
            job.LastError = ex.Message;

            if (job.Attempts >= job.MaxAttempts)
            {
                job.Status = BackgroundJobStatus.DeadLetter;
                _logger.LogWarning("Job {JobId} reached max attempts. Marked as DEAD_LETTER.", job.Id);
            }
            else
            {
                job.Status = BackgroundJobStatus.Pending;
                job.AvailableAt = DateTimeOffset.UtcNow.AddSeconds(Math.Pow(2, job.Attempts) * 5); // Exponential backoff
            }

            job.LockedAt = null;
            job.LockedBy = null;
            await context.SaveChangesAsync(cancellationToken);
        }

        return true;
    }
}
