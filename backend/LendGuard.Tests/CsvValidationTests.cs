using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using LendGuard.Application.Common.Interfaces;
using LendGuard.Application.Services;
using LendGuard.Domain;
using LendGuard.Domain.Entities;
using LendGuard.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace LendGuard.Tests;

public class CsvValidationTests
{
    private (LendGuardDbContext context, ImportService service, Mock<IFileStorageService> storageMock) CreateTestSetup()
    {
        var options = new DbContextOptionsBuilder<LendGuardDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        var context = new LendGuardDbContext(options);
        var storageMock = new Mock<IFileStorageService>();
        var auditMock = new Mock<IAuditService>();

        var service = new ImportService(context, storageMock.Object, auditMock.Object);

        return (context, service, storageMock);
    }

    [Fact]
    public async Task IMP01_ValidCsv_ValidatesRowsSuccessfully()
    {
        // Arrange
        var (context, service, storageMock) = CreateTestSetup();
        var csvContent = "transaction_reference,external_reference,transaction_date,amount,currency,transaction_type\n" +
                         "TXN-001,EXT-001,2026-11-17T09:00:00Z,10000.00,INR,REPAYMENT\n" +
                         "TXN-002,EXT-002,2026-11-17T10:00:00Z,5500.00,INR,REPAYMENT\n";

        var fileBytes = Encoding.UTF8.GetBytes(csvContent);
        storageMock.Setup(s => s.SaveUploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
                   .ReturnsAsync(("mock_path.csv", "mock_hash_123"));
        storageMock.Setup(s => s.OpenReadAsync("mock_path.csv", It.IsAny<CancellationToken>()))
                   .ReturnsAsync(new MemoryStream(fileBytes));

        var uploader = new User { Id = Guid.NewGuid(), FullName = "Uploader", Email = "up@example.com", Role = UserRole.Analyst };
        context.Users.Add(uploader);
        await context.SaveChangesAsync();

        // Act
        using var uploadStream = new MemoryStream(fileBytes);
        var uploadRes = await service.UploadFileAsync(uploadStream, "internal_valid.csv", SourceType.Internal, uploader.Id);

        // Assert
        var batch = await context.ImportBatches.FindAsync(uploadRes.ImportId);
        Assert.NotNull(batch);
        Assert.Equal(ImportBatchStatus.ValidationCompleted, batch.Status);
        Assert.Equal(2, batch.TotalRows);
        Assert.Equal(2, batch.ValidRows);
        Assert.Equal(0, batch.RejectedRows);
    }

    [Fact]
    public async Task IMP02_MalformedAmount_RejectsRowWithInvalidDecimalError()
    {
        // Arrange
        var (context, service, storageMock) = CreateTestSetup();
        var csvContent = "transaction_reference,external_reference,transaction_date,amount,currency,transaction_type\n" +
                         "TXN-VALID,EXT-001,2026-11-17T09:00:00Z,10000.00,INR,REPAYMENT\n" +
                         "TXN-BAD,EXT-002,2026-11-17T10:00:00Z,NOT_A_NUMBER,INR,REPAYMENT\n";

        var fileBytes = Encoding.UTF8.GetBytes(csvContent);
        storageMock.Setup(s => s.SaveUploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
                   .ReturnsAsync(("mock_path.csv", "mock_hash_123"));
        storageMock.Setup(s => s.OpenReadAsync("mock_path.csv", It.IsAny<CancellationToken>()))
                   .ReturnsAsync(new MemoryStream(fileBytes));

        var uploader = new User { Id = Guid.NewGuid(), FullName = "Uploader", Email = "up2@example.com", Role = UserRole.Analyst };
        context.Users.Add(uploader);
        await context.SaveChangesAsync();

        // Act
        using var uploadStream = new MemoryStream(fileBytes);
        var uploadRes = await service.UploadFileAsync(uploadStream, "internal_bad.csv", SourceType.Internal, uploader.Id);

        // Assert
        var batch = await context.ImportBatches.FindAsync(uploadRes.ImportId);
        Assert.NotNull(batch);
        Assert.Equal(2, batch.TotalRows);
        Assert.Equal(1, batch.ValidRows);
        Assert.Equal(1, batch.RejectedRows);

        var errors = await context.ImportRowErrors.Where(e => e.ImportBatchId == batch.Id).ToListAsync();
        Assert.Single(errors);
        Assert.Equal("INVALID_DECIMAL", errors[0].ErrorCode);
        Assert.Equal("amount", errors[0].FieldName);
    }

    [Fact]
    public async Task IMP04_IdempotentConfirmation_DoesNotDuplicateTransactions()
    {
        // Arrange
        var (context, service, storageMock) = CreateTestSetup();
        var csvContent = "transaction_reference,external_reference,transaction_date,amount,currency,transaction_type\n" +
                         "TXN-001,EXT-001,2026-11-17T09:00:00Z,10000.00,INR,REPAYMENT\n";

        var fileBytes = Encoding.UTF8.GetBytes(csvContent);
        storageMock.Setup(s => s.SaveUploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
                   .ReturnsAsync(("mock_path.csv", "mock_hash_123"));
        storageMock.Setup(s => s.OpenReadAsync("mock_path.csv", It.IsAny<CancellationToken>()))
                   .ReturnsAsync(() => new MemoryStream(fileBytes));

        var uploader = new User { Id = Guid.NewGuid(), FullName = "Uploader", Email = "up3@example.com", Role = UserRole.Analyst };
        context.Users.Add(uploader);
        await context.SaveChangesAsync();

        using var uploadStream = new MemoryStream(fileBytes);
        var uploadRes = await service.UploadFileAsync(uploadStream, "test.csv", SourceType.Internal, uploader.Id);

        // Act 1: First Confirmation
        var res1 = await service.ConfirmBatchAsync(uploadRes.ImportId, true, uploader.Id);

        // Act 2: Second Confirmation (repeated)
        var res2 = await service.ConfirmBatchAsync(uploadRes.ImportId, true, uploader.Id);

        // Assert
        Assert.Equal(ImportBatchStatus.Imported, res1.Status);
        Assert.Equal(ImportBatchStatus.Imported, res2.Status);
        Assert.Equal(1, res1.ImportedRows);

        var txnCount = await context.Transactions.CountAsync(t => t.ImportBatchId == uploadRes.ImportId);
        Assert.Equal(1, txnCount); // Exactly 1 row persisted, never duplicated!
    }
}
