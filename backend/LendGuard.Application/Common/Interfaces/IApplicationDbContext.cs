using System.Threading;
using System.Threading.Tasks;
using LendGuard.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

namespace LendGuard.Application.Common.Interfaces;

public interface IApplicationDbContext
{
    DbSet<User> Users { get; }
    DbSet<ImportBatch> ImportBatches { get; }
    DbSet<Transaction> Transactions { get; }
    DbSet<ImportRowError> ImportRowErrors { get; }
    DbSet<ReconciliationRun> ReconciliationRuns { get; }
    DbSet<ReconciliationMatch> ReconciliationMatches { get; }
    DbSet<ReconciliationMatchItem> ReconciliationMatchItems { get; }
    DbSet<DiscrepancyException> Exceptions { get; }
    DbSet<PasswordResetToken> PasswordResetTokens { get; }
    DbSet<InvestigationNote> InvestigationNotes { get; }
    DbSet<AiAnalysis> AiAnalyses { get; }
    DbSet<AuditLog> AuditLogs { get; }
    DbSet<BackgroundJob> BackgroundJobs { get; }
    DbSet<ReconciliationPolicy> ReconciliationPolicies { get; }

    DatabaseFacade Database { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
