using System;
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

public class ExceptionWorkflowTests
{
    private (LendGuardDbContext context, ExceptionService service) CreateTestSetup()
    {
        var options = new DbContextOptionsBuilder<LendGuardDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        var context = new LendGuardDbContext(options);
        var auditMock = new Mock<IAuditService>();
        var aiClientMock = new Mock<IAiClientService>();

        var service = new ExceptionService(context, auditMock.Object, aiClientMock.Object);

        return (context, service);
    }

    private (LendGuardDbContext context, ExceptionService service) CreateTestSetupWithAi(Mock<IAiClientService> aiMock)
    {
        var options = new DbContextOptionsBuilder<LendGuardDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        var context = new LendGuardDbContext(options);
        var auditMock = new Mock<IAuditService>();

        var service = new ExceptionService(context, auditMock.Object, aiMock.Object);

        return (context, service);
    }

    [Fact]
    public async Task EXC01_AdminAssignsException_UpdatesAssigneeAndStatus()
    {
        // Arrange
        var (context, service) = CreateTestSetup();
        var adminId = Guid.NewGuid();
        var analyst = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Jane Analyst",
            Email = "jane@example.com",
            Role = UserRole.Analyst,
            IsActive = true
        };

        var exception = new DiscrepancyException
        {
            Id = Guid.NewGuid(),
            ReconciliationRunId = Guid.NewGuid(),
            ExceptionType = ExceptionType.AmountMismatch,
            Severity = ExceptionSeverity.High,
            Status = ExceptionStatus.Open,
            DiscrepancyAmount = 500.00m
        };

        context.Users.Add(analyst);
        context.Exceptions.Add(exception);
        await context.SaveChangesAsync();

        // Act
        var result = await service.AssignExceptionAsync(exception.Id, new AssignExceptionRequest { AssignedTo = analyst.Id }, adminId);

        // Assert
        Assert.NotNull(result.AssignedTo);
        Assert.Equal(analyst.Id, result.AssignedTo.Id);
        Assert.Equal(ExceptionStatus.InProgress, result.Status);
    }

    [Fact]
    public async Task EXC02_AnalystFiltersAssignedToMe_ReturnsOnlyAssignedExceptions()
    {
        // Arrange
        var (context, service) = CreateTestSetup();
        var analystId = Guid.NewGuid();
        var otherAnalystId = Guid.NewGuid();

        context.Users.Add(new User
        {
            Id = analystId,
            FullName = "Primary Analyst",
            Email = "analyst@lendguard.internal",
            Role = UserRole.Analyst,
            IsActive = true
        });

        context.Users.Add(new User
        {
            Id = otherAnalystId,
            FullName = "Other Analyst",
            Email = "other@lendguard.internal",
            Role = UserRole.Analyst,
            IsActive = true
        });

        // 1 assigned to this analyst
        context.Exceptions.Add(new DiscrepancyException
        {
            Id = Guid.NewGuid(),
            ReconciliationRunId = Guid.NewGuid(),
            ExceptionType = ExceptionType.AmountMismatch,
            Severity = ExceptionSeverity.High,
            Status = ExceptionStatus.InProgress,
            AssignedTo = analystId,
            CreatedAt = DateTimeOffset.UtcNow
        });

        // 1 unassigned
        context.Exceptions.Add(new DiscrepancyException
        {
            Id = Guid.NewGuid(),
            ReconciliationRunId = Guid.NewGuid(),
            ExceptionType = ExceptionType.MissingSettlement,
            Severity = ExceptionSeverity.Medium,
            Status = ExceptionStatus.Open,
            AssignedTo = null,
            CreatedAt = DateTimeOffset.UtcNow
        });

        // 1 assigned to other analyst
        context.Exceptions.Add(new DiscrepancyException
        {
            Id = Guid.NewGuid(),
            ReconciliationRunId = Guid.NewGuid(),
            ExceptionType = ExceptionType.Duplicate,
            Severity = ExceptionSeverity.Low,
            Status = ExceptionStatus.InProgress,
            AssignedTo = otherAnalystId,
            CreatedAt = DateTimeOffset.UtcNow
        });

        await context.SaveChangesAsync();

        // Act 1: Analyst queries with assignedTo = analystId (clicks "Assigned to Me")
        var assignedResult = await service.GetExceptionsAsync(
            page: 1, pageSize: 20, assignedTo: analystId, currentUserId: analystId, currentUserRole: UserRole.Analyst
        );

        // Assert 1: Only the 1 exception assigned to them is returned
        Assert.Single(assignedResult.Items);
        Assert.Equal(analystId, assignedResult.Items[0].AssignedTo!.Id);

        // Act 2: Analyst queries with default intake (assignedTo = null)
        var intakeResult = await service.GetExceptionsAsync(
            page: 1, pageSize: 20, assignedTo: null, currentUserId: analystId, currentUserRole: UserRole.Analyst
        );

        // Assert 2: Shows their assigned exception + the unassigned exception (2 total), but NOT the other analyst's exception!
        Assert.Equal(2, intakeResult.Items.Count);
    }

    [Fact]
    public async Task EXC03_ResolveWithoutExplanation_ThrowsArgumentException()
    {
        // Arrange
        var (context, service) = CreateTestSetup();
        var exception = new DiscrepancyException
        {
            Id = Guid.NewGuid(),
            ReconciliationRunId = Guid.NewGuid(),
            ExceptionType = ExceptionType.MissingSettlement,
            Severity = ExceptionSeverity.High,
            Status = ExceptionStatus.Open
        };
        context.Exceptions.Add(exception);
        await context.SaveChangesAsync();

        // Act & Assert
        await Assert.ThrowsAsync<ArgumentException>(() => service.ResolveExceptionAsync(
            exception.Id,
            new ResolveExceptionRequest { ResolutionCategory = "SETTLEMENT_CONFIRMED", Explanation = "" },
            Guid.NewGuid()
        ));
    }

    [Fact]
    public async Task ResolveException_ValidPayload_TransitionsToResolved()
    {
        // Arrange
        var (context, service) = CreateTestSetup();
        var resolverId = Guid.NewGuid();
        var exception = new DiscrepancyException
        {
            Id = Guid.NewGuid(),
            ReconciliationRunId = Guid.NewGuid(),
            ExceptionType = ExceptionType.AmountMismatch,
            Severity = ExceptionSeverity.High,
            Status = ExceptionStatus.Open
        };
        context.Exceptions.Add(exception);
        await context.SaveChangesAsync();

        // Act
        var result = await service.ResolveExceptionAsync(
            exception.Id,
            new ResolveExceptionRequest
            {
                ResolutionCategory = "SETTLEMENT_CONFIRMED",
                Explanation = "Difference verified against bank fee schedule."
            },
            resolverId
        );

        // Assert
        Assert.Equal(ExceptionStatus.Resolved, result.Status);
        Assert.Equal("SETTLEMENT_CONFIRMED", result.ResolutionCategory);
        Assert.Equal("Difference verified against bank fee schedule.", result.ResolutionExplanation);
        Assert.NotNull(result.ResolvedAt);
    }

    [Fact]
    public async Task IDOR_AnalystCannotAccessOrModifyAnotherAnalystsException()
    {
        // Arrange
        var (context, service) = CreateTestSetup();
        var analystAId = Guid.NewGuid();
        var analystBId = Guid.NewGuid();

        var exception = new DiscrepancyException
        {
            Id = Guid.NewGuid(),
            ReconciliationRunId = Guid.NewGuid(),
            ExceptionType = ExceptionType.AmountMismatch,
            Severity = ExceptionSeverity.High,
            Status = ExceptionStatus.InProgress,
            AssignedTo = analystAId,
            DiscrepancyAmount = 500m
        };
        context.Exceptions.Add(exception);
        await context.SaveChangesAsync();

        // Act & Assert 1: Analyst B cannot view Analyst A's exception
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            service.GetExceptionByIdAsync(exception.Id, analystBId, UserRole.Analyst));

        // Act & Assert 2: Analyst B cannot add note to Analyst A's exception
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            service.AddInvestigationNoteAsync(exception.Id, new AddInvestigationNoteRequest { Note = "Malicious Note" }, analystBId, UserRole.Analyst));

        // Act & Assert 3: Analyst B cannot resolve Analyst A's exception
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            service.ResolveExceptionAsync(exception.Id, new ResolveExceptionRequest { ResolutionCategory = "MANUAL_ADJUSTMENT", Explanation = "Unauthorized resolve" }, analystBId, UserRole.Analyst));
    }

    [Fact]
    public async Task AI01_TriggerDualAiAnalysis_StoresBothAnomalyScoreAndExplanation()
    {
        // Arrange
        var aiMock = new Mock<IAiClientService>();
        var (context, service) = CreateTestSetupWithAi(aiMock);
        var adminId = Guid.NewGuid();

        var exception = new DiscrepancyException
        {
            Id = Guid.NewGuid(),
            ReconciliationRunId = Guid.NewGuid(),
            ExceptionType = ExceptionType.AmountMismatch,
            Severity = ExceptionSeverity.High,
            Status = ExceptionStatus.Open,
            DiscrepancyAmount = 15000.00m,
            ExpectedAmount = 125000.00m,
            ActualAmount = 110000.00m
        };
        context.Exceptions.Add(exception);
        await context.SaveChangesAsync();

        aiMock.Setup(m => m.AnalyzeAnomalyAsync(It.IsAny<DiscrepancyException>(), It.IsAny<Transaction>(), default))
            .ReturnsAsync(new AiAnalysisDto
            {
                AnalysisId = Guid.NewGuid(),
                Status = AiAnalysisStatus.Completed,
                AnalysisType = AiAnalysisType.Anomaly,
                Summary = "Anomaly Risk Score: 88% (CRITICAL Risk).",
                Evidence = new { anomalyScore = 0.88, riskLevel = "CRITICAL", signals = new[] { "CRITICAL_AMOUNT_DEVIATION", "HIGH_VALUE_EXPOSURE" } },
                Recommendation = "Prioritize immediate manual ledger reconciliation.",
                AdvisoryOnly = true,
                ModelName = "scikit-learn/isolation-forest-v1.2"
            });

        aiMock.Setup(m => m.ExplainExceptionAsync(It.IsAny<DiscrepancyException>(), It.IsAny<Transaction>(), It.IsAny<Transaction>(), default))
            .ReturnsAsync(new AiAnalysisDto
            {
                AnalysisId = Guid.NewGuid(),
                Status = AiAnalysisStatus.Completed,
                AnalysisType = AiAnalysisType.Explanation,
                Summary = "Discrepancy of INR 15,000 matches fee withholding pattern.",
                Recommendation = "Verify bank remittance schedule.",
                AdvisoryOnly = true,
                ModelName = "nvidia/nemotron-3.5-bolt-e4b"
            });

        // Act
        var result = await service.TriggerAiAnalysisAsync(exception.Id, new TriggerAiAnalysisRequest { AnalysisType = "ALL" }, adminId, UserRole.Admin);

        // Assert
        Assert.NotNull(result);
        var analyses = await service.GetExceptionAnalysesAsync(exception.Id, latestOnly: true);
        Assert.Equal(2, analyses.Count);
        Assert.Contains(analyses, a => a.AnalysisType == AiAnalysisType.Anomaly && a.Summary != null && a.Summary.Contains("88%"));
        Assert.Contains(analyses, a => a.AnalysisType == AiAnalysisType.Explanation && a.ModelName == "nvidia/nemotron-3.5-bolt-e4b");
    }

    [Fact]
    public async Task RT01_AssignAndResolveException_BroadcastsSignalRNotifications()
    {
        // Arrange
        var options = new DbContextOptionsBuilder<LendGuardDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        using var context = new LendGuardDbContext(options);
        var auditMock = new Mock<IAuditService>();
        var aiMock = new Mock<IAiClientService>();
        var notifMock = new Mock<INotificationService>();

        var service = new ExceptionService(context, auditMock.Object, aiMock.Object, notifMock.Object);

        var adminId = Guid.NewGuid();
        var analyst = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Anu Sushmitha",
            Email = "sanushusmitha@gmail.com",
            Role = UserRole.Analyst,
            IsActive = true
        };
        context.Users.Add(analyst);

        var exc = new DiscrepancyException
        {
            Id = Guid.NewGuid(),
            ReconciliationRunId = Guid.NewGuid(),
            ExceptionType = ExceptionType.AmountMismatch,
            Severity = ExceptionSeverity.High,
            Status = ExceptionStatus.Open,
            DiscrepancyAmount = 500.00m
        };
        context.Exceptions.Add(exc);
        await context.SaveChangesAsync();

        // Act 1: Assign
        await service.AssignExceptionAsync(exc.Id, new AssignExceptionRequest { AssignedTo = analyst.Id }, adminId);

        // Act 2: Resolve
        await service.ResolveExceptionAsync(exc.Id, new ResolveExceptionRequest
        {
            ResolutionCategory = "CONFIRMED_FEE",
            Explanation = "Gateway fee reconciled"
        }, analyst.Id, UserRole.Analyst);

        // Assert both SignalR events fired
        notifMock.Verify(n => n.BroadcastEventAsync(
            "EXCEPTION_ASSIGNED",
            It.IsAny<string>(),
            It.Is<string>(msg => msg.Contains("Anu Sushmitha")),
            It.IsAny<object>(),
            It.IsAny<System.Threading.CancellationToken>()), Times.Once);

        notifMock.Verify(n => n.BroadcastEventAsync(
            "EXCEPTION_RESOLVED",
            It.IsAny<string>(),
            It.Is<string>(msg => msg.Contains("CONFIRMED_FEE")),
            It.IsAny<object>(),
            It.IsAny<System.Threading.CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RT02_BatchAssignExceptions_BroadcastsBatchSignalRNotification()
    {
        // Arrange
        var options = new DbContextOptionsBuilder<LendGuardDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        using var context = new LendGuardDbContext(options);
        var auditMock = new Mock<IAuditService>();
        var aiMock = new Mock<IAiClientService>();
        var notifMock = new Mock<INotificationService>();

        var service = new ExceptionService(context, auditMock.Object, aiMock.Object, notifMock.Object);

        var adminId = Guid.NewGuid();
        var analyst = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Operational Analyst",
            Email = "staging.analyst@lendguard.internal",
            Role = UserRole.Analyst,
            IsActive = true
        };
        context.Users.Add(analyst);

        var exc1 = new DiscrepancyException { Id = Guid.NewGuid(), ReconciliationRunId = Guid.NewGuid(), ExceptionType = ExceptionType.AmountMismatch, Severity = ExceptionSeverity.Medium, Status = ExceptionStatus.Open };
        var exc2 = new DiscrepancyException { Id = Guid.NewGuid(), ReconciliationRunId = Guid.NewGuid(), ExceptionType = ExceptionType.MissingSettlement, Severity = ExceptionSeverity.Low, Status = ExceptionStatus.Open };
        context.Exceptions.AddRange(exc1, exc2);
        await context.SaveChangesAsync();

        // Act
        var res = await service.BatchAssignExceptionsAsync(new BatchAssignExceptionsRequest
        {
            ExceptionIds = new List<Guid> { exc1.Id, exc2.Id },
            AssignedTo = analyst.Id
        }, adminId);

        // Assert
        Assert.Equal(2, res.AssignedCount);
        notifMock.Verify(n => n.BroadcastEventAsync(
            "BATCH_ASSIGNED",
            It.IsAny<string>(),
            It.Is<string>(msg => msg.Contains("2 discrepancies")),
            It.IsAny<object>(),
            It.IsAny<System.Threading.CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GL01_PostPrescriptiveJournal_ValidatesBalanceAndPersistsAuditLog()
    {
        // Arrange
        var options = new DbContextOptionsBuilder<LendGuardDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        using var context = new LendGuardDbContext(options);
        var auditMock = new Mock<IAuditService>();
        var aiMock = new Mock<IAiClientService>();
        var notifMock = new Mock<INotificationService>();
        var service = new ExceptionService(context, auditMock.Object, aiMock.Object, notifMock.Object);

        var exc = new DiscrepancyException
        {
            Id = Guid.NewGuid(),
            ReconciliationRunId = Guid.NewGuid(),
            ExceptionType = ExceptionType.AmountMismatch,
            Severity = ExceptionSeverity.High,
            Status = ExceptionStatus.Open,
            DiscrepancyAmount = 250.00m
        };
        context.Exceptions.Add(exc);
        await context.SaveChangesAsync();

        var userId = Guid.NewGuid();

        // Reject imbalanced lines
        await Assert.ThrowsAsync<ArgumentException>(() => service.PostPrescriptiveJournalAsync(exc.Id, new PostJournalRequest
        {
            Currency = "INR",
            Strategy = "Bad Balance",
            Lines = new List<JournalLineDto>
            {
                new() { AccountCode = "5120", AccountName = "Fee", Debit = 250m, Credit = 0m },
                new() { AccountCode = "1310", AccountName = "Receivable", Debit = 0m, Credit = 100m }
            }
        }, userId, UserRole.Admin));

        // Act: valid balanced journal
        var posted = await service.PostPrescriptiveJournalAsync(exc.Id, new PostJournalRequest
        {
            Currency = "INR",
            Strategy = "Gateway Fee Reclassification",
            Memo = "Reconcile fee",
            Lines = new List<JournalLineDto>
            {
                new() { AccountCode = "5120", AccountName = "Gateway Fee", Debit = 250m, Credit = 0m },
                new() { AccountCode = "1020", AccountName = "Cash", Debit = 9750m, Credit = 0m },
                new() { AccountCode = "1310", AccountName = "Receivable", Debit = 0m, Credit = 10000m }
            }
        }, userId, UserRole.Admin);

        Assert.Equal("POSTED", posted.Status);
        Assert.Equal(10000m, posted.TotalDebit);
        Assert.Equal(10000m, posted.TotalCredit);
        auditMock.Verify(a => a.LogAsync("JOURNAL_POSTED", "EXCEPTION", exc.Id, userId, It.IsAny<object>(), null, It.IsAny<System.Threading.CancellationToken>()), Times.Once);
    }
}
