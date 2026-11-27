using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using LendGuard.Domain;
using LendGuard.Domain.Entities;
using LendGuard.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace LendGuard.Tests;

public class OutboxConcurrencyStressTests
{
    private const string ConnectionString = "Host=localhost;Port=5433;Database=lendguard;Username=app;Password=lendguard_password;Maximum Pool Size=50;";
    private static readonly SemaphoreSlim SchemaLock = new(1, 1);
    private static bool _schemaReady;

    private LendGuardDbContext CreateRealDbContext()
    {
        var options = new DbContextOptionsBuilder<LendGuardDbContext>()
            .UseNpgsql(ConnectionString)
            .UseSnakeCaseNamingConvention()
            .Options;
        var ctx = new LendGuardDbContext(options);
        if (!_schemaReady)
        {
            SchemaLock.Wait();
            try
            {
                if (!_schemaReady)
                {
                    ctx.Database.EnsureCreated();
                    _schemaReady = true;
                }
            }
            finally
            {
                SchemaLock.Release();
            }
        }
        return ctx;
    }

    [Fact]
    public async Task Outbox_ConcurrentWorkers_ClaimJobsWithZeroDuplicatesAndZeroDeadlocks()
    {
        const int totalJobs = 50;
        const int concurrentWorkers = 10;
        var batchTag = $"STRESS-{Guid.NewGuid():N}";

        // 1. Seed test jobs
        using (var setupContext = CreateRealDbContext())
        {
            var jobs = new List<BackgroundJob>();
            for (int i = 0; i < totalJobs; i++)
            {
                jobs.Add(new BackgroundJob
                {
                    Id = Guid.NewGuid(),
                    JobType = BackgroundJobType.Reconciliation,
                    Payload = $"{{\"testTag\":\"{batchTag}\",\"index\":{i}}}",
                    Status = BackgroundJobStatus.Pending,
                    Attempts = 0,
                    MaxAttempts = 3,
                    AvailableAt = DateTimeOffset.UtcNow,
                    CreatedAt = DateTimeOffset.UtcNow
                });
            }
            setupContext.BackgroundJobs.AddRange(jobs);
            await setupContext.SaveChangesAsync();
        }

        var claimedJobIds = new ConcurrentBag<Guid>();
        var workerExecutionCounts = new ConcurrentDictionary<string, int>();
        int deadlockCount = 0;
        var stopwatch = Stopwatch.StartNew();

        // 2. Launch concurrent workers competing with FOR UPDATE SKIP LOCKED
        var workerTasks = Enumerable.Range(1, concurrentWorkers).Select(async workerIndex =>
        {
            var workerId = $"stress-worker-{workerIndex}";
            workerExecutionCounts[workerId] = 0;

            while (claimedJobIds.Count < totalJobs && stopwatch.Elapsed < TimeSpan.FromSeconds(30))
            {
                try
                {
                    using var context = CreateRealDbContext();
                    using var tx = await context.Database.BeginTransactionAsync();

                    var job = await context.BackgroundJobs
                        .FromSqlRaw(@"SELECT * FROM background_jobs 
                                      WHERE status = 'PENDING' 
                                        AND payload::text LIKE {0}
                                        AND available_at <= now() 
                                      ORDER BY created_at 
                                      FOR UPDATE SKIP LOCKED 
                                      LIMIT 1", $"%{batchTag}%")
                        .FirstOrDefaultAsync();

                    if (job == null)
                    {
                        await tx.RollbackAsync();
                        await Task.Delay(20);
                        continue;
                    }

                    job.Status = BackgroundJobStatus.Processing;
                    job.LockedAt = DateTimeOffset.UtcNow;
                    job.LockedBy = workerId;
                    job.Attempts++;
                    await context.SaveChangesAsync();
                    await tx.CommitAsync();

                    claimedJobIds.Add(job.Id);
                    workerExecutionCounts[workerId]++;

                    // Simulate processing latency
                    await Task.Delay(10);

                    // Mark completed
                    job.Status = BackgroundJobStatus.Completed;
                    job.ProcessedAt = DateTimeOffset.UtcNow;
                    await context.SaveChangesAsync();
                }
                catch (Exception ex) when (ex.Message.Contains("deadlock", StringComparison.OrdinalIgnoreCase))
                {
                    Interlocked.Increment(ref deadlockCount);
                }
                catch
                {
                    // Context / network hiccup retry
                    await Task.Delay(50);
                }
            }
        });

        await Task.WhenAll(workerTasks);
        stopwatch.Stop();

        // 3. Cleanup test jobs
        using (var cleanupContext = CreateRealDbContext())
        {
            await cleanupContext.Database.ExecuteSqlRawAsync("DELETE FROM background_jobs WHERE payload::text LIKE {0}", $"%{batchTag}%");
        }

        // 4. Assertions
        var totalClaimed = claimedJobIds.Count;
        var uniqueClaims = claimedJobIds.Distinct().Count();
        var duplicateClaims = totalClaimed - uniqueClaims;

        Assert.Equal(0, deadlockCount);
        Assert.Equal(0, duplicateClaims); // MUST BE 0 DUPLICATES
        Assert.True(totalClaimed >= totalJobs, $"Expected at least {totalJobs} claimed, but got {totalClaimed}");
    }

    [Fact]
    public async Task Outbox_StuckJobRecovery_SuccessfullyRequeuesExpiredLockedJob()
    {
        var testId = Guid.NewGuid();
        var batchTag = $"STUCK-{Guid.NewGuid():N}";

        using (var context = CreateRealDbContext())
        {
            var stuckJob = new BackgroundJob
            {
                Id = testId,
                JobType = BackgroundJobType.Reconciliation,
                Payload = $"{{\"testTag\":\"{batchTag}\"}}",
                Status = BackgroundJobStatus.Processing,
                LockedAt = DateTimeOffset.UtcNow.AddMinutes(-10), // Expired past 5 min threshold
                LockedBy = "crashed-worker-999",
                Attempts = 1,
                MaxAttempts = 3,
                AvailableAt = DateTimeOffset.UtcNow.AddMinutes(-10),
                CreatedAt = DateTimeOffset.UtcNow.AddMinutes(-10)
            };
            context.BackgroundJobs.Add(stuckJob);
            await context.SaveChangesAsync();
        }

        // Run recovery query
        using (var recoveryContext = CreateRealDbContext())
        {
            var recovered = await recoveryContext.BackgroundJobs
                .FromSqlRaw(@"SELECT * FROM background_jobs 
                              WHERE status = 'PROCESSING' 
                                AND locked_at <= (now() - interval '5 minutes')
                                AND attempts < max_attempts
                                AND id = {0}
                              FOR UPDATE SKIP LOCKED 
                              LIMIT 1", testId)
                .FirstOrDefaultAsync();

            Assert.NotNull(recovered);
            Assert.Equal("crashed-worker-999", recovered.LockedBy);

            // Requeue
            recovered.Status = BackgroundJobStatus.Pending;
            recovered.AvailableAt = DateTimeOffset.UtcNow;
            await recoveryContext.SaveChangesAsync();
        }

        // Verify status is now PENDING
        using (var verifyContext = CreateRealDbContext())
        {
            var job = await verifyContext.BackgroundJobs.FindAsync(testId);
            Assert.NotNull(job);
            Assert.Equal(BackgroundJobStatus.Pending, job.Status);

            // Cleanup
            verifyContext.BackgroundJobs.Remove(job);
            await verifyContext.SaveChangesAsync();
        }
    }
}
