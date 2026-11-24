using System;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using Xunit;

public class ReconciliationEngineTests
{
    private LendGuardContext CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<LendGuardContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new LendGuardContext(options);
    }

    [Fact]
    public void Reconcile_ExactMatch_MarksAsMatched()
    {
        using var context = CreateInMemoryContext();
        var date = new DateTime(2026, 11, 20);

        context.Transactions.Add(new Transaction
        {
            ReferenceId = "REF_MATCH_01",
            Amount = 150.00m,
            TransactionDate = date,
            SourceSystem = "Internal"
        });

        context.Transactions.Add(new Transaction
        {
            ReferenceId = "REF_MATCH_01",
            Amount = 150.00m,
            TransactionDate = date,
            SourceSystem = "External"
        });

        context.SaveChanges();

        var service = new ReconciliationService(context);
        var result = service.Reconcile("Test Runner");

        Assert.Equal(1, result.MatchedCount);
        Assert.Equal(0, result.AmountMismatchCount);
        Assert.Empty(result.GeneratedExceptions);
        Assert.Equal(100.00m, result.SuccessRate);
    }

    [Fact]
    public void Reconcile_AmountMismatch_GeneratesException()
    {
        using var context = CreateInMemoryContext();
        var date = new DateTime(2026, 11, 20);

        context.Transactions.Add(new Transaction
        {
            ReferenceId = "REF_MISMATCH_01",
            Amount = 500.00m,
            TransactionDate = date,
            SourceSystem = "Internal"
        });

        context.Transactions.Add(new Transaction
        {
            ReferenceId = "REF_MISMATCH_01",
            Amount = 450.00m,
            TransactionDate = date,
            SourceSystem = "External"
        });

        context.SaveChanges();

        var service = new ReconciliationService(context);
        var result = service.Reconcile("Test Runner");

        Assert.Equal(0, result.MatchedCount);
        Assert.Equal(1, result.AmountMismatchCount);
        Assert.Single(result.GeneratedExceptions);
        Assert.Equal("AmountMismatch", result.GeneratedExceptions.First().ExceptionType);
    }

    [Fact]
    public void Reconcile_MissingExternal_GeneratesMissingExternalException()
    {
        using var context = CreateInMemoryContext();
        var date = new DateTime(2026, 11, 20);

        context.Transactions.Add(new Transaction
        {
            ReferenceId = "REF_INTERNAL_ONLY",
            Amount = 1200.00m,
            TransactionDate = date,
            SourceSystem = "Internal"
        });

        context.SaveChanges();

        var service = new ReconciliationService(context);
        var result = service.Reconcile("Test Runner");

        Assert.Equal(1, result.UnmatchedInternalCount);
        Assert.Single(result.GeneratedExceptions);
        Assert.Equal("MissingExternal", result.GeneratedExceptions.First().ExceptionType);
    }

    [Fact]
    public void Reconcile_DuplicateInternal_FlagsDuplicateAndGeneratesException()
    {
        using var context = CreateInMemoryContext();
        var date = new DateTime(2026, 11, 20);

        context.Transactions.Add(new Transaction
        {
            ReferenceId = "REF_DUP_01",
            Amount = 300.00m,
            TransactionDate = date,
            SourceSystem = "Internal"
        });

        context.Transactions.Add(new Transaction
        {
            ReferenceId = "REF_DUP_01",
            Amount = 300.00m,
            TransactionDate = date,
            SourceSystem = "Internal"
        });

        context.SaveChanges();

        var service = new ReconciliationService(context);
        var result = service.Reconcile("Test Runner");

        Assert.Equal(1, result.DuplicateCount);
        Assert.Contains(result.GeneratedExceptions, e => e.ExceptionType == "DuplicateInternal");
    }

    [Fact]
    public void Reconcile_PartialSettlement_GeneratesPartialSettlementException()
    {
        using var context = CreateInMemoryContext();
        var date = new DateTime(2026, 11, 20);

        context.Transactions.Add(new Transaction
        {
            ReferenceId = "REF_PARTIAL_01",
            Amount = 1200.00m,
            TransactionDate = date,
            SourceSystem = "Internal"
        });

        context.Transactions.Add(new Transaction
        {
            ReferenceId = "REF_PARTIAL_01",
            Amount = 600.00m,
            TransactionDate = date,
            SourceSystem = "External"
        });

        context.SaveChanges();

        var service = new ReconciliationService(context);
        var result = service.Reconcile("Test Runner");

        Assert.Equal(1, result.PartialSettlementCount);
        Assert.Single(result.GeneratedExceptions);
        Assert.Equal("PartialSettlement", result.GeneratedExceptions.First().ExceptionType);
    }
}
