using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using LendGuard.Application.Common.Interfaces;
using LendGuard.Application.DTOs;
using LendGuard.Application.Services;
using LendGuard.Domain;
using LendGuard.Domain.Entities;
using LendGuard.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace LendGuard.Tests;

public class ReconciliationEngineTests
{
    private (LendGuardDbContext context, ReconciliationService service) CreateTestSetup()
    {
        var options = new DbContextOptionsBuilder<LendGuardDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        var context = new LendGuardDbContext(options);
        var auditMock = new Mock<IAuditService>();
        var service = new ReconciliationService(context, auditMock.Object);

        return (context, service);
    }

    private (ImportBatch intBatch, ImportBatch extBatch) SeedBatches(LendGuardDbContext context, Guid adminId)
    {
        var intBatch = new ImportBatch
        {
            Id = Guid.NewGuid(),
            BatchReference = $"IMP-INT-{Guid.NewGuid():N}",
            SourceType = SourceType.Internal,
            FileName = "internal.csv",
            FilePath = "storage/internal.csv",
            FileHash = "hash1",
            Status = ImportBatchStatus.Imported,
            UploadedBy = adminId,
            CreatedAt = DateTimeOffset.UtcNow
        };

        var extBatch = new ImportBatch
        {
            Id = Guid.NewGuid(),
            BatchReference = $"IMP-EXT-{Guid.NewGuid():N}",
            SourceType = SourceType.External,
            FileName = "external.csv",
            FilePath = "storage/external.csv",
            FileHash = "hash2",
            Status = ImportBatchStatus.Imported,
            UploadedBy = adminId,
            CreatedAt = DateTimeOffset.UtcNow
        };

        context.ImportBatches.AddRange(intBatch, extBatch);
        return (intBatch, extBatch);
    }

    [Fact]
    public async Task RC01_RC02_ExactMatch_MatchesExactCandidateAndAmountWithinTolerance()
    {
        // Arrange
        var (context, service) = CreateTestSetup();
        var adminId = Guid.NewGuid();
        var (intBatch, extBatch) = SeedBatches(context, adminId);
        var now = DateTimeOffset.UtcNow;

        var intTxn = new Transaction
        {
            Id = Guid.NewGuid(),
            ImportBatchId = intBatch.Id,
            SourceRowNumber = 1,
            TransactionReference = "TXN-EXACT-01",
            TransactionDate = now,
            Amount = 15000.00m,
            Currency = "INR",
            SourceType = SourceType.Internal,
            Status = TransactionStatus.Pending
        };

        var extTxn = new Transaction
        {
            Id = Guid.NewGuid(),
            ImportBatchId = extBatch.Id,
            SourceRowNumber = 1,
            TransactionReference = "EXT-EXACT-01",
            ExternalReference = "TXN-EXACT-01",
            TransactionDate = now,
            Amount = 15000.00m,
            Currency = "INR",
            SourceType = SourceType.External,
            Status = TransactionStatus.Pending
        };

        var run = new ReconciliationRun
        {
            Id = Guid.NewGuid(),
            InternalBatchId = intBatch.Id,
            ExternalBatchId = extBatch.Id,
            StartedBy = adminId,
            Status = ReconciliationRunStatus.Queued,
            RuleVersion = "recon-v1;tolerance=0d"
        };

        context.Transactions.AddRange(intTxn, extTxn);
        context.ReconciliationRuns.Add(run);
        await context.SaveChangesAsync();

        // Act
        await service.ExecuteReconciliationRunAsync(run.Id);

        // Assert
        var updatedRun = await context.ReconciliationRuns.FindAsync(run.Id);
        Assert.NotNull(updatedRun);
        Assert.Equal(ReconciliationRunStatus.Completed, updatedRun.Status);
        Assert.Equal(1, updatedRun.MatchedCount);
        Assert.Equal(0, updatedRun.ExceptionCount);

        var matches = await context.ReconciliationMatches.Where(m => m.ReconciliationRunId == run.Id).ToListAsync();
        Assert.Single(matches);
        Assert.Equal(Domain.MatchType.Exact, matches[0].MatchType);
        Assert.Equal(100.00m, matches[0].Confidence);

        var updatedInt = await context.Transactions.FindAsync(intTxn.Id);
        var updatedExt = await context.Transactions.FindAsync(extTxn.Id);
        Assert.Equal(TransactionStatus.Matched, updatedInt!.Status);
        Assert.Equal(TransactionStatus.Matched, updatedExt!.Status);
    }

    [Fact]
    public async Task RC03_AmountMismatch_CreatesAmountMismatchException()
    {
        // Arrange
        var (context, service) = CreateTestSetup();
        var adminId = Guid.NewGuid();
        var (intBatch, extBatch) = SeedBatches(context, adminId);
        var now = DateTimeOffset.UtcNow;

        var intTxn = new Transaction
        {
            Id = Guid.NewGuid(),
            ImportBatchId = intBatch.Id,
            SourceRowNumber = 1,
            TransactionReference = "TXN-AMT-02",
            TransactionDate = now,
            Amount = 25000.00m,
            Currency = "INR",
            SourceType = SourceType.Internal,
            Status = TransactionStatus.Pending
        };

        var extTxn = new Transaction
        {
            Id = Guid.NewGuid(),
            ImportBatchId = extBatch.Id,
            SourceRowNumber = 1,
            TransactionReference = "EXT-AMT-02",
            ExternalReference = "TXN-AMT-02",
            TransactionDate = now,
            Amount = 24500.00m,
            Currency = "INR",
            SourceType = SourceType.External,
            Status = TransactionStatus.Pending
        };

        var run = new ReconciliationRun
        {
            Id = Guid.NewGuid(),
            InternalBatchId = intBatch.Id,
            ExternalBatchId = extBatch.Id,
            StartedBy = adminId,
            Status = ReconciliationRunStatus.Queued,
            RuleVersion = "recon-v1;tolerance=0d"
        };

        context.Transactions.AddRange(intTxn, extTxn);
        context.ReconciliationRuns.Add(run);
        await context.SaveChangesAsync();

        // Act
        await service.ExecuteReconciliationRunAsync(run.Id);

        // Assert
        var exceptions = await context.Exceptions.Where(e => e.ReconciliationRunId == run.Id).ToListAsync();
        Assert.Single(exceptions);
        Assert.Equal(ExceptionType.AmountMismatch, exceptions[0].ExceptionType);
        Assert.Equal(25000.00m, exceptions[0].ExpectedAmount);
        Assert.Equal(24500.00m, exceptions[0].ActualAmount);
        Assert.Equal(500.00m, exceptions[0].DiscrepancyAmount);
        Assert.Equal(ExceptionSeverity.High, exceptions[0].Severity);
    }

    [Fact]
    public async Task RC04_MissingSettlement_CreatesMissingSettlementException()
    {
        // Arrange
        var (context, service) = CreateTestSetup();
        var adminId = Guid.NewGuid();
        var (intBatch, extBatch) = SeedBatches(context, adminId);

        var intTxn = new Transaction
        {
            Id = Guid.NewGuid(),
            ImportBatchId = intBatch.Id,
            SourceRowNumber = 1,
            TransactionReference = "TXN-MISSING-03",
            TransactionDate = DateTimeOffset.UtcNow,
            Amount = 8000.00m,
            Currency = "INR",
            SourceType = SourceType.Internal,
            Status = TransactionStatus.Pending
        };

        var run = new ReconciliationRun
        {
            Id = Guid.NewGuid(),
            InternalBatchId = intBatch.Id,
            ExternalBatchId = extBatch.Id,
            StartedBy = adminId,
            Status = ReconciliationRunStatus.Queued,
            RuleVersion = "recon-v1;tolerance=0d"
        };

        context.Transactions.Add(intTxn);
        context.ReconciliationRuns.Add(run);
        await context.SaveChangesAsync();

        // Act
        await service.ExecuteReconciliationRunAsync(run.Id);

        // Assert
        var exceptions = await context.Exceptions.Where(e => e.ReconciliationRunId == run.Id).ToListAsync();
        Assert.Single(exceptions);
        Assert.Equal(ExceptionType.MissingSettlement, exceptions[0].ExceptionType);
        Assert.Equal(8000.00m, exceptions[0].ExpectedAmount);
        Assert.Equal(8000.00m, exceptions[0].DiscrepancyAmount);
    }

    [Fact]
    public async Task RC05_UnmatchedExternal_CreatesUnmatchedExternalException()
    {
        // Arrange
        var (context, service) = CreateTestSetup();
        var adminId = Guid.NewGuid();
        var (intBatch, extBatch) = SeedBatches(context, adminId);

        var extTxn = new Transaction
        {
            Id = Guid.NewGuid(),
            ImportBatchId = extBatch.Id,
            SourceRowNumber = 1,
            TransactionReference = "EXT-ORPHAN-04",
            TransactionDate = DateTimeOffset.UtcNow,
            Amount = 12000.00m,
            Currency = "INR",
            SourceType = SourceType.External,
            Status = TransactionStatus.Pending
        };

        var run = new ReconciliationRun
        {
            Id = Guid.NewGuid(),
            InternalBatchId = intBatch.Id,
            ExternalBatchId = extBatch.Id,
            StartedBy = adminId,
            Status = ReconciliationRunStatus.Queued,
            RuleVersion = "recon-v1;tolerance=0d"
        };

        context.Transactions.Add(extTxn);
        context.ReconciliationRuns.Add(run);
        await context.SaveChangesAsync();

        // Act
        await service.ExecuteReconciliationRunAsync(run.Id);

        // Assert
        var exceptions = await context.Exceptions.Where(e => e.ReconciliationRunId == run.Id).ToListAsync();
        Assert.Single(exceptions);
        Assert.Equal(ExceptionType.UnmatchedExternal, exceptions[0].ExceptionType);
        Assert.Equal(12000.00m, exceptions[0].ActualAmount);
        Assert.Equal(12000.00m, exceptions[0].DiscrepancyAmount);
    }

    [Fact]
    public async Task RC06_DuplicateRecordDetection_FlagsAllDuplicatesAsExceptions()
    {
        // Arrange
        var (context, service) = CreateTestSetup();
        var adminId = Guid.NewGuid();
        var (intBatch, extBatch) = SeedBatches(context, adminId);

        var intTxn1 = new Transaction
        {
            Id = Guid.NewGuid(),
            ImportBatchId = intBatch.Id,
            SourceRowNumber = 1,
            TransactionReference = "TXN-DUP-05",
            TransactionDate = DateTimeOffset.UtcNow,
            Amount = 10000.00m,
            Currency = "INR",
            SourceType = SourceType.Internal,
            Status = TransactionStatus.Pending
        };

        var intTxn2 = new Transaction
        {
            Id = Guid.NewGuid(),
            ImportBatchId = intBatch.Id,
            SourceRowNumber = 2,
            TransactionReference = "TXN-DUP-05",
            TransactionDate = DateTimeOffset.UtcNow,
            Amount = 10000.00m,
            Currency = "INR",
            SourceType = SourceType.Internal,
            Status = TransactionStatus.Pending
        };

        var run = new ReconciliationRun
        {
            Id = Guid.NewGuid(),
            InternalBatchId = intBatch.Id,
            ExternalBatchId = extBatch.Id,
            StartedBy = adminId,
            Status = ReconciliationRunStatus.Queued,
            RuleVersion = "recon-v1;tolerance=0d"
        };

        context.Transactions.AddRange(intTxn1, intTxn2);
        context.ReconciliationRuns.Add(run);
        await context.SaveChangesAsync();

        // Act
        await service.ExecuteReconciliationRunAsync(run.Id);

        // Assert
        var exceptions = await context.Exceptions.Where(e => e.ReconciliationRunId == run.Id).ToListAsync();
        Assert.Equal(2, exceptions.Count);
        Assert.All(exceptions, e => Assert.Equal(ExceptionType.Duplicate, e.ExceptionType));
    }

    [Fact]
    public async Task RC07A_AggregateMatch_AggregatesMultiPartSettlementWhenSumEqualsInternal()
    {
        // Arrange
        var (context, service) = CreateTestSetup();
        var adminId = Guid.NewGuid();
        var (intBatch, extBatch) = SeedBatches(context, adminId);
        var now = DateTimeOffset.UtcNow;

        var intTxn = new Transaction
        {
            Id = Guid.NewGuid(),
            ImportBatchId = intBatch.Id,
            SourceRowNumber = 1,
            TransactionReference = "TXN-AGG-06",
            TransactionDate = now,
            Amount = 30000.00m,
            Currency = "INR",
            SourceType = SourceType.Internal,
            Status = TransactionStatus.Pending
        };

        var extTxn1 = new Transaction
        {
            Id = Guid.NewGuid(),
            ImportBatchId = extBatch.Id,
            SourceRowNumber = 1,
            TransactionReference = "EXT-AGG-06A",
            ExternalReference = "TXN-AGG-06",
            TransactionDate = now,
            Amount = 18000.00m,
            Currency = "INR",
            SourceType = SourceType.External,
            Status = TransactionStatus.Pending
        };

        var extTxn2 = new Transaction
        {
            Id = Guid.NewGuid(),
            ImportBatchId = extBatch.Id,
            SourceRowNumber = 2,
            TransactionReference = "EXT-AGG-06B",
            ExternalReference = "TXN-AGG-06",
            TransactionDate = now,
            Amount = 12000.00m,
            Currency = "INR",
            SourceType = SourceType.External,
            Status = TransactionStatus.Pending
        };

        var run = new ReconciliationRun
        {
            Id = Guid.NewGuid(),
            InternalBatchId = intBatch.Id,
            ExternalBatchId = extBatch.Id,
            StartedBy = adminId,
            Status = ReconciliationRunStatus.Queued,
            RuleVersion = "recon-v1;tolerance=0d"
        };

        context.Transactions.AddRange(intTxn, extTxn1, extTxn2);
        context.ReconciliationRuns.Add(run);
        await context.SaveChangesAsync();

        // Act
        await service.ExecuteReconciliationRunAsync(run.Id);

        // Assert
        var matches = await context.ReconciliationMatches.Where(m => m.ReconciliationRunId == run.Id).ToListAsync();
        Assert.Single(matches);
        Assert.Equal(Domain.MatchType.Aggregate, matches[0].MatchType);
        Assert.Equal(95.00m, matches[0].Confidence);

        var updatedInt = await context.Transactions.FindAsync(intTxn.Id);
        Assert.Equal(TransactionStatus.Matched, updatedInt!.Status);
    }

    [Fact]
    public async Task RC07B_PartialSettlement_CreatesPartialSettlementExceptionWhenSumIsDeficit()
    {
        // Arrange
        var (context, service) = CreateTestSetup();
        var adminId = Guid.NewGuid();
        var (intBatch, extBatch) = SeedBatches(context, adminId);
        var now = DateTimeOffset.UtcNow;

        var intTxn = new Transaction
        {
            Id = Guid.NewGuid(),
            ImportBatchId = intBatch.Id,
            SourceRowNumber = 1,
            TransactionReference = "TXN-PARTIAL-07",
            TransactionDate = now,
            Amount = 50000.00m,
            Currency = "INR",
            SourceType = SourceType.Internal,
            Status = TransactionStatus.Pending
        };

        var extTxn1 = new Transaction
        {
            Id = Guid.NewGuid(),
            ImportBatchId = extBatch.Id,
            SourceRowNumber = 1,
            TransactionReference = "EXT-PARTIAL-07A",
            ExternalReference = "TXN-PARTIAL-07",
            TransactionDate = now,
            Amount = 20000.00m,
            Currency = "INR",
            SourceType = SourceType.External,
            Status = TransactionStatus.Pending
        };

        var extTxn2 = new Transaction
        {
            Id = Guid.NewGuid(),
            ImportBatchId = extBatch.Id,
            SourceRowNumber = 2,
            TransactionReference = "EXT-PARTIAL-07B",
            ExternalReference = "TXN-PARTIAL-07",
            TransactionDate = now,
            Amount = 15000.00m,
            Currency = "INR",
            SourceType = SourceType.External,
            Status = TransactionStatus.Pending
        };

        var run = new ReconciliationRun
        {
            Id = Guid.NewGuid(),
            InternalBatchId = intBatch.Id,
            ExternalBatchId = extBatch.Id,
            StartedBy = adminId,
            Status = ReconciliationRunStatus.Queued,
            RuleVersion = "recon-v1;tolerance=0d"
        };

        context.Transactions.AddRange(intTxn, extTxn1, extTxn2);
        context.ReconciliationRuns.Add(run);
        await context.SaveChangesAsync();

        // Act
        await service.ExecuteReconciliationRunAsync(run.Id);

        // Assert
        var exceptions = await context.Exceptions.Where(e => e.ReconciliationRunId == run.Id).ToListAsync();
        Assert.Single(exceptions);
        Assert.Equal(ExceptionType.PartialSettlement, exceptions[0].ExceptionType);
        Assert.Equal(50000.00m, exceptions[0].ExpectedAmount);
        Assert.Equal(35000.00m, exceptions[0].ActualAmount);
        Assert.Equal(15000.00m, exceptions[0].DiscrepancyAmount);
    }

    [Fact]
    public async Task RC08_AmbiguousMatch_MultipleCandidatesWithConflictingAmounts_FlagsAmbiguousWithoutArbitraryMatch()
    {
        // Arrange: Multiple external candidates with conflicting amounts that exceed internal amount
        var (context, service) = CreateTestSetup();
        var adminId = Guid.NewGuid();
        var (intBatch, extBatch) = SeedBatches(context, adminId);
        var now = DateTimeOffset.UtcNow;

        var intTxn = new Transaction
        {
            Id = Guid.NewGuid(),
            ImportBatchId = intBatch.Id,
            SourceRowNumber = 1,
            TransactionReference = "TXN-AMB-08",
            TransactionDate = now,
            Amount = 20000.00m,
            Currency = "INR",
            SourceType = SourceType.Internal,
            Status = TransactionStatus.Pending
        };

        var extTxn1 = new Transaction
        {
            Id = Guid.NewGuid(),
            ImportBatchId = extBatch.Id,
            SourceRowNumber = 1,
            TransactionReference = "EXT-AMB-08A",
            ExternalReference = "TXN-AMB-08",
            TransactionDate = now,
            Amount = 15000.00m,
            Currency = "INR",
            SourceType = SourceType.External,
            Status = TransactionStatus.Pending
        };

        var extTxn2 = new Transaction
        {
            Id = Guid.NewGuid(),
            ImportBatchId = extBatch.Id,
            SourceRowNumber = 2,
            TransactionReference = "EXT-AMB-08B",
            ExternalReference = "TXN-AMB-08",
            TransactionDate = now,
            Amount = 10000.00m, // Sum = 25000 > 20000
            Currency = "INR",
            SourceType = SourceType.External,
            Status = TransactionStatus.Pending
        };

        var run = new ReconciliationRun
        {
            Id = Guid.NewGuid(),
            InternalBatchId = intBatch.Id,
            ExternalBatchId = extBatch.Id,
            StartedBy = adminId,
            Status = ReconciliationRunStatus.Queued,
            RuleVersion = "recon-v1;tolerance=0d"
        };

        context.Transactions.AddRange(intTxn, extTxn1, extTxn2);
        context.ReconciliationRuns.Add(run);
        await context.SaveChangesAsync();

        // Act
        await service.ExecuteReconciliationRunAsync(run.Id);

        // Assert: No match should be created arbitrarily
        var matches = await context.ReconciliationMatches.Where(m => m.ReconciliationRunId == run.Id).ToListAsync();
        Assert.Empty(matches);

        var exceptions = await context.Exceptions.Where(e => e.ReconciliationRunId == run.Id).ToListAsync();
        Assert.Single(exceptions);
        Assert.Equal(ExceptionType.AmbiguousMatch, exceptions[0].ExceptionType);
        Assert.Equal(20000.00m, exceptions[0].ExpectedAmount);
        Assert.Equal(25000.00m, exceptions[0].ActualAmount);
    }

    [Fact]
    public async Task RC08_AmbiguousMatch_DateToleranceViolation_FlagsAmbiguousWhenOutsideWindow()
    {
        // Arrange
        var (context, service) = CreateTestSetup();
        var adminId = Guid.NewGuid();
        var (intBatch, extBatch) = SeedBatches(context, adminId);

        var intTxn = new Transaction
        {
            Id = Guid.NewGuid(),
            ImportBatchId = intBatch.Id,
            SourceRowNumber = 1,
            TransactionReference = "TXN-DATE-09",
            TransactionDate = DateTimeOffset.Parse("2026-11-10T10:00:00Z"),
            Amount = 7500.00m,
            Currency = "INR",
            SourceType = SourceType.Internal,
            Status = TransactionStatus.Pending
        };

        var extTxn = new Transaction
        {
            Id = Guid.NewGuid(),
            ImportBatchId = extBatch.Id,
            SourceRowNumber = 1,
            TransactionReference = "EXT-DATE-09",
            ExternalReference = "TXN-DATE-09",
            TransactionDate = DateTimeOffset.Parse("2026-11-16T10:00:00Z"), // 6 days difference
            Amount = 7500.00m,
            Currency = "INR",
            SourceType = SourceType.External,
            Status = TransactionStatus.Pending
        };

        var run = new ReconciliationRun
        {
            Id = Guid.NewGuid(),
            InternalBatchId = intBatch.Id,
            ExternalBatchId = extBatch.Id,
            StartedBy = adminId,
            Status = ReconciliationRunStatus.Queued,
            RuleVersion = "recon-v1;tolerance=2d" // Configured tolerance window 2 days
        };

        context.Transactions.AddRange(intTxn, extTxn);
        context.ReconciliationRuns.Add(run);
        await context.SaveChangesAsync();

        // Act
        await service.ExecuteReconciliationRunAsync(run.Id);

        // Assert
        var matches = await context.ReconciliationMatches.Where(m => m.ReconciliationRunId == run.Id).ToListAsync();
        Assert.Empty(matches);

        var exceptions = await context.Exceptions.Where(e => e.ReconciliationRunId == run.Id).ToListAsync();
        Assert.Single(exceptions);
        Assert.Equal(ExceptionType.AmbiguousMatch, exceptions[0].ExceptionType);
    }
}
