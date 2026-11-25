using System;
using LendGuard.Application.Common.Interfaces;
using LendGuard.Domain;
using LendGuard.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace LendGuard.Infrastructure.Persistence;

public class LendGuardDbContext : DbContext, IApplicationDbContext
{
    public LendGuardDbContext(DbContextOptions<LendGuardDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<ImportBatch> ImportBatches => Set<ImportBatch>();
    public DbSet<Transaction> Transactions => Set<Transaction>();
    public DbSet<ImportRowError> ImportRowErrors => Set<ImportRowError>();
    public DbSet<ReconciliationRun> ReconciliationRuns => Set<ReconciliationRun>();
    public DbSet<ReconciliationMatch> ReconciliationMatches => Set<ReconciliationMatch>();
    public DbSet<ReconciliationMatchItem> ReconciliationMatchItems => Set<ReconciliationMatchItem>();
    public DbSet<DiscrepancyException> Exceptions => Set<DiscrepancyException>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<InvestigationNote> InvestigationNotes => Set<InvestigationNote>();
    public DbSet<AiAnalysis> AiAnalyses => Set<AiAnalysis>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<BackgroundJob> BackgroundJobs => Set<BackgroundJob>();
    public DbSet<ReconciliationPolicy> ReconciliationPolicies => Set<ReconciliationPolicy>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // users
        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("users");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.FullName).HasMaxLength(150).IsRequired();
            entity.Property(e => e.Email).HasMaxLength(255).IsRequired();
            entity.HasIndex(e => e.Email).IsUnique();
            entity.Property(e => e.PasswordHash).IsRequired();
            entity.Property(e => e.Role).HasMaxLength(30).IsRequired();
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("now()");
            entity.HasIndex(e => new { e.Role, e.IsActive });
        });

        // import_batches
        modelBuilder.Entity<ImportBatch>(entity =>
        {
            entity.ToTable("import_batches");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.BatchReference).HasMaxLength(100).IsRequired();
            entity.HasIndex(e => e.BatchReference).IsUnique();
            entity.Property(e => e.SourceType).HasMaxLength(20).IsRequired();
            entity.Property(e => e.FileName).HasMaxLength(255).IsRequired();
            entity.Property(e => e.FilePath).IsRequired();
            entity.Property(e => e.FileHash).HasMaxLength(128).IsRequired();
            entity.Property(e => e.Status).HasMaxLength(30).IsRequired();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");

            entity.HasOne(e => e.Uploader)
                  .WithMany(u => u.UploadedBatches)
                  .HasForeignKey(e => e.UploadedBy)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => new { e.SourceType, e.Status, e.CreatedAt });
            entity.HasIndex(e => e.UploadedBy);
            entity.HasIndex(e => e.FileHash);
        });

        // transactions
        modelBuilder.Entity<Transaction>(entity =>
        {
            entity.ToTable("transactions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.TransactionReference).HasMaxLength(150).IsRequired();
            entity.Property(e => e.ExternalReference).HasMaxLength(150);
            entity.Property(e => e.Amount).HasColumnType("numeric(18,2)").IsRequired();
            entity.Property(e => e.Currency).HasColumnType("char(3)").IsRequired();
            entity.Property(e => e.TransactionType).HasMaxLength(50);
            entity.Property(e => e.SourceType).HasMaxLength(20).IsRequired();
            entity.Property(e => e.Status).HasMaxLength(30).HasDefaultValue(TransactionStatus.Pending).IsRequired();
            entity.Property(e => e.RawData).HasColumnType("jsonb").IsRequired();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");

            entity.HasOne(e => e.ImportBatch)
                  .WithMany(b => b.Transactions)
                  .HasForeignKey(e => e.ImportBatchId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => new { e.ImportBatchId, e.SourceRowNumber }).IsUnique();
            entity.HasIndex(e => e.TransactionReference);
            entity.HasIndex(e => e.ExternalReference);
            entity.HasIndex(e => e.TransactionDate);
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.ImportBatchId);
        });

        // import_row_errors
        modelBuilder.Entity<ImportRowError>(entity =>
        {
            entity.ToTable("import_row_errors");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.FieldName).HasMaxLength(100);
            entity.Property(e => e.ErrorCode).HasMaxLength(60).IsRequired();
            entity.Property(e => e.ErrorMessage).IsRequired();
            entity.Property(e => e.RawRow).HasColumnType("jsonb");

            entity.HasOne(e => e.ImportBatch)
                  .WithMany(b => b.RowErrors)
                  .HasForeignKey(e => e.ImportBatchId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => new { e.ImportBatchId, e.RowNumber });
        });

        // reconciliation_runs
        modelBuilder.Entity<ReconciliationRun>(entity =>
        {
            entity.ToTable("reconciliation_runs");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Status).HasMaxLength(30).IsRequired();
            entity.Property(e => e.RuleVersion).HasMaxLength(40).IsRequired();
            entity.Property(e => e.StartedAt).HasDefaultValueSql("now()");
            entity.Property(e => e.FailureCode).HasMaxLength(60);

            entity.HasOne(e => e.InternalBatch)
                  .WithMany(b => b.InternalReconciliationRuns)
                  .HasForeignKey(e => e.InternalBatchId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.ExternalBatch)
                  .WithMany(b => b.ExternalReconciliationRuns)
                  .HasForeignKey(e => e.ExternalBatchId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Starter)
                  .WithMany(u => u.StartedRuns)
                  .HasForeignKey(e => e.StartedBy)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => new { e.Status, e.StartedAt });
            entity.HasIndex(e => new { e.InternalBatchId, e.ExternalBatchId });
        });

        // reconciliation_matches
        modelBuilder.Entity<ReconciliationMatch>(entity =>
        {
            entity.ToTable("reconciliation_matches");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.MatchType).HasMaxLength(30).IsRequired();
            entity.Property(e => e.Confidence).HasColumnType("numeric(5,2)");
            entity.Property(e => e.Evidence).HasColumnType("jsonb").IsRequired();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");

            entity.HasOne(e => e.ReconciliationRun)
                  .WithMany(r => r.Matches)
                  .HasForeignKey(e => e.ReconciliationRunId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => e.ReconciliationRunId);
        });

        // reconciliation_match_items
        modelBuilder.Entity<ReconciliationMatchItem>(entity =>
        {
            entity.ToTable("reconciliation_match_items");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Side).HasMaxLength(10).IsRequired();
            entity.Property(e => e.AmountApplied).HasColumnType("numeric(18,2)").IsRequired();

            entity.HasOne(e => e.ReconciliationMatch)
                  .WithMany(m => m.MatchItems)
                  .HasForeignKey(e => e.ReconciliationMatchId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Transaction)
                  .WithMany(t => t.MatchItems)
                  .HasForeignKey(e => e.TransactionId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => new { e.ReconciliationMatchId, e.TransactionId }).IsUnique();
            entity.HasIndex(e => e.TransactionId);
        });

        // exceptions
        modelBuilder.Entity<DiscrepancyException>(entity =>
        {
            entity.ToTable("exceptions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.ExceptionType).HasMaxLength(50).IsRequired();
            entity.Property(e => e.Severity).HasMaxLength(20).IsRequired();
            entity.Property(e => e.Status).HasMaxLength(30).HasDefaultValue(ExceptionStatus.Open).IsRequired();
            entity.Property(e => e.ExpectedAmount).HasColumnType("numeric(18,2)");
            entity.Property(e => e.ActualAmount).HasColumnType("numeric(18,2)");
            entity.Property(e => e.DiscrepancyAmount).HasColumnType("numeric(18,2)");
            entity.Property(e => e.ResolutionCategory).HasMaxLength(60);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("now()");

            entity.HasOne(e => e.ReconciliationRun)
                  .WithMany(r => r.Exceptions)
                  .HasForeignKey(e => e.ReconciliationRunId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.InternalTransaction)
                  .WithMany(t => t.InternalExceptions)
                  .HasForeignKey(e => e.InternalTransactionId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(e => e.ExternalTransaction)
                  .WithMany(t => t.ExternalExceptions)
                  .HasForeignKey(e => e.ExternalTransactionId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(e => e.Assignee)
                  .WithMany()
                  .HasForeignKey(e => e.AssignedTo)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(e => e.Resolver)
                  .WithMany()
                  .HasForeignKey(e => e.ResolvedBy)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(e => new { e.Status, e.Severity });
            entity.HasIndex(e => new { e.AssignedTo, e.Status });
            entity.HasIndex(e => e.ReconciliationRunId);
            entity.HasIndex(e => e.ExceptionType);
        });

        // password_reset_tokens
        modelBuilder.Entity<PasswordResetToken>(entity =>
        {
            entity.ToTable("password_reset_tokens");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.TokenHash).HasMaxLength(128).IsRequired();
            entity.HasIndex(e => e.TokenHash).IsUnique();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");

            entity.HasOne(e => e.User)
                  .WithMany(u => u.PasswordResetTokens)
                  .HasForeignKey(e => e.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => new { e.UserId, e.ExpiresAt });
        });

        // investigation_notes
        modelBuilder.Entity<InvestigationNote>(entity =>
        {
            entity.ToTable("investigation_notes");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Note).IsRequired();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");

            entity.HasOne(e => e.Exception)
                  .WithMany(x => x.Notes)
                  .HasForeignKey(e => e.ExceptionId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.User)
                  .WithMany(u => u.InvestigationNotes)
                  .HasForeignKey(e => e.UserId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => new { e.ExceptionId, e.CreatedAt });
        });

        // ai_analyses
        modelBuilder.Entity<AiAnalysis>(entity =>
        {
            entity.ToTable("ai_analyses");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.AnalysisType).HasMaxLength(30).IsRequired();
            entity.Property(e => e.ModelName).HasMaxLength(100);
            entity.Property(e => e.ModelVersion).HasMaxLength(100);
            entity.Property(e => e.Result).HasColumnType("jsonb");
            entity.Property(e => e.Status).HasMaxLength(30).IsRequired();
            entity.Property(e => e.FailureCode).HasMaxLength(60);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");

            entity.HasOne(e => e.Exception)
                  .WithMany(x => x.AiAnalyses)
                  .HasForeignKey(e => e.ExceptionId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => new { e.ExceptionId, e.CreatedAt });
            entity.HasIndex(e => e.Status);
        });

        // audit_logs
        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.ToTable("audit_logs");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Action).HasMaxLength(100).IsRequired();
            entity.Property(e => e.EntityType).HasMaxLength(100).IsRequired();
            entity.Property(e => e.Details).HasColumnType("jsonb").HasDefaultValue("{}").IsRequired();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");

            entity.HasOne(e => e.User)
                  .WithMany(u => u.AuditLogs)
                  .HasForeignKey(e => e.UserId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(e => e.CreatedAt);
            entity.HasIndex(e => new { e.UserId, e.CreatedAt });
            entity.HasIndex(e => new { e.EntityType, e.EntityId });
        });

        // background_jobs
        modelBuilder.Entity<BackgroundJob>(entity =>
        {
            entity.ToTable("background_jobs");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.JobType).HasMaxLength(50).IsRequired();
            entity.Property(e => e.Payload).HasColumnType("jsonb").IsRequired();
            entity.Property(e => e.Status).HasMaxLength(30).HasDefaultValue(BackgroundJobStatus.Pending).IsRequired();
            entity.Property(e => e.LockedBy).HasMaxLength(100);
            entity.Property(e => e.AvailableAt).HasDefaultValueSql("now()");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");

            entity.HasIndex(e => new { e.Status, e.AvailableAt });
            entity.HasIndex(e => new { e.JobType, e.Status });
        });

        // reconciliation_policies
        modelBuilder.Entity<ReconciliationPolicy>(entity =>
        {
            entity.ToTable("reconciliation_policies");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.ProfileId).HasMaxLength(30).HasDefaultValue("strict").IsRequired();
            entity.Property(e => e.AmountTolerancePercent).HasColumnType("numeric(8,4)").IsRequired();
            entity.Property(e => e.FixedRupeeTolerance).HasColumnType("numeric(18,2)").IsRequired();
            entity.Property(e => e.IsolationForestOutlierThreshold).HasColumnType("numeric(5,2)").IsRequired();
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("now()");
        });
    }
}
