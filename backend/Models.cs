using Microsoft.EntityFrameworkCore;
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

public class LendGuardContext : DbContext
{
    public LendGuardContext(DbContextOptions<LendGuardContext> options) : base(options) { }

    public DbSet<Transaction> Transactions { get; set; } = null!;
    public DbSet<ExceptionRecord> Exceptions { get; set; } = null!;
    public DbSet<User> Users { get; set; } = null!;
    public DbSet<ImportHistory> ImportHistories { get; set; } = null!;
    public DbSet<OutboxMessage> OutboxMessages { get; set; } = null!;
    public DbSet<ReconciliationBatch> ReconciliationBatches { get; set; } = null!;
    public DbSet<InvestigationNote> InvestigationNotes { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Transaction>()
            .HasIndex(t => t.ReferenceId);

        modelBuilder.Entity<Transaction>()
            .HasIndex(t => t.SourceSystem);

        modelBuilder.Entity<Transaction>()
            .HasIndex(t => t.ReconciliationStatus);

        modelBuilder.Entity<ExceptionRecord>()
            .HasIndex(e => e.TransactionReference);

        modelBuilder.Entity<ExceptionRecord>()
            .HasIndex(e => e.Status);

        modelBuilder.Entity<OutboxMessage>()
            .HasIndex(o => o.Status);
    }
}

public class Transaction
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string ReferenceId { get; set; } = string.Empty;

    public DateTime TransactionDate { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal Amount { get; set; }

    [MaxLength(10)]
    public string Currency { get; set; } = "USD";

    [MaxLength(50)]
    public string Type { get; set; } = "Payment"; // Payment, Refund, Fee, Transfer

    [MaxLength(50)]
    public string Status { get; set; } = "Completed"; // Completed, Pending, Failed

    [MaxLength(50)]
    public string SourceSystem { get; set; } = "Internal"; // Internal, External

    [MaxLength(50)]
    public string ReconciliationStatus { get; set; } = "Pending"; // Pending, Matched, Discrepancy, Duplicate

    [MaxLength(100)]
    public string? BatchId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class ExceptionRecord
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string TransactionReference { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string ExceptionType { get; set; } = string.Empty; 
    // MissingInternal, MissingExternal, AmountMismatch, DuplicateInternal, DuplicateExternal, PartialSettlement

    [Required]
    [MaxLength(20)]
    public string Severity { get; set; } = "Medium"; // Low, Medium, High, Critical

    [Column(TypeName = "decimal(18,2)")]
    public decimal Amount { get; set; }

    public string Description { get; set; } = string.Empty;

    public string Evidence { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? AssignedEmployeeId { get; set; }

    [MaxLength(150)]
    public string? AssignedEmployeeName { get; set; }

    [Required]
    [MaxLength(50)]
    public string Status { get; set; } = "Open"; // Open, Assigned, In Progress, Resolved, Closed

    [MaxLength(100)]
    public string? ResolutionCategory { get; set; } // TimingDifference, FeeAdjustment, FalsePositive, RefundReversal, SystemError

    public string? ResolutionExplanation { get; set; }

    public DateTime? ResolutionTimestamp { get; set; }

    [MaxLength(150)]
    public string? ResolvedBy { get; set; }

    // AI-Assisted Advisory Details
    public double? AiAnomalyScore { get; set; }

    [MaxLength(50)]
    public string? AiClassification { get; set; } // Normal, Warning, Anomalous

    public string? AiExplanation { get; set; }

    public string? AiRecommendedSteps { get; set; } // JSON or newline-separated

    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

    public DateTime? LastUpdatedDate { get; set; }
}

public class InvestigationNote
{
    [Key]
    public int Id { get; set; }

    public int ExceptionRecordId { get; set; }

    [Required]
    public string NoteText { get; set; } = string.Empty;

    [Required]
    [MaxLength(150)]
    public string AuthorName { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class User
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Username { get; set; } = string.Empty;

    [MaxLength(150)]
    public string FullName { get; set; } = string.Empty;

    [MaxLength(150)]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string PasswordHash { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public string Role { get; set; } = "Operations Analyst"; // Administrator, Operations Analyst

    [MaxLength(100)]
    public string Department { get; set; } = "Financial Operations";

    public bool IsActive { get; set; } = true;

    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
}

public class ImportHistory
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(255)]
    public string FileName { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public string SourceSystem { get; set; } = "Internal"; // Internal, External

    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

    public int TotalRows { get; set; }

    public int AcceptedRows { get; set; }

    public int RejectedRows { get; set; }

    [MaxLength(50)]
    public string Status { get; set; } = "Completed";

    public string? ValidationErrorsJson { get; set; }
}

public class OutboxMessage
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [MaxLength(100)]
    public string EventType { get; set; } = string.Empty;

    [Required]
    public string Payload { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? ProcessedAt { get; set; }

    [MaxLength(30)]
    public string Status { get; set; } = "Pending"; // Pending, Processing, Processed, Failed

    public int RetryCount { get; set; } = 0;

    public string? ErrorMessage { get; set; }
}

public class ReconciliationBatch
{
    [Key]
    public int Id { get; set; }

    public DateTime ExecutedAt { get; set; } = DateTime.UtcNow;

    public int MatchedCount { get; set; }

    public int UnmatchedInternalCount { get; set; }

    public int UnmatchedExternalCount { get; set; }

    public int DuplicateCount { get; set; }

    public int AmountMismatchCount { get; set; }

    public int PartialSettlementCount { get; set; }

    [Column(TypeName = "decimal(5,2)")]
    public decimal SuccessRate { get; set; }

    [MaxLength(150)]
    public string ExecutedBy { get; set; } = "System Admin";
}
