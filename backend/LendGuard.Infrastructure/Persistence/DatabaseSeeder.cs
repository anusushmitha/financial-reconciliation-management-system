using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using LendGuard.Domain;
using LendGuard.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace LendGuard.Infrastructure.Persistence;

public static class DatabaseSeeder
{
    public static async Task SeedAsync(LendGuardDbContext context, ILogger logger, IConfiguration? configuration = null)
    {
        logger.LogInformation("Ensuring standard enterprise users and active workloads are seeded...");

        var seedTestUsers = !string.Equals(configuration?["SEED_TEST_USERS"], "false", StringComparison.OrdinalIgnoreCase);

        var defaultAccounts = new[]
        {
            new { Id = Guid.Parse("5671a1c9-07e4-4239-81cc-20287f5bdb39"), Name = "Staging Enterprise Administrator", Email = "staging.admin@lendguard.internal", Password = "StagingAdmin_Secure2026!", Role = UserRole.Admin, IsDevSeed = false },
            new { Id = Guid.Parse("fc803e91-9e96-436b-8634-a817a4324f0f"), Name = "Staging Operational Analyst", Email = "staging.analyst@lendguard.internal", Password = "StagingAnalyst_Secure2026!", Role = UserRole.Analyst, IsDevSeed = false },
            new { Id = Guid.Parse("0bacefdb-b578-4289-8667-c6ff227df176"), Name = "Anu Sushmitha", Email = "sanushusmitha@gmail.com", Password = "Analyst123!", Role = UserRole.Analyst, IsDevSeed = false },
            new { Id = Guid.Parse("e7f2ded3-5736-421e-8440-e9e9000ffa8b"), Name = "Admin User", Email = "admin@example.com", Password = "Admin123!", Role = UserRole.Admin, IsDevSeed = true },
            new { Id = Guid.Parse("c1520d9b-c95b-495c-ace4-50b0ce9e22da"), Name = "Analyst User", Email = "analyst@example.com", Password = "Analyst123!", Role = UserRole.Analyst, IsDevSeed = true },
        };

        foreach (var acc in defaultAccounts)
        {
            var existing = await context.Users.FirstOrDefaultAsync(u => u.Email == acc.Email);
            if (acc.IsDevSeed && !seedTestUsers)
            {
                if (existing != null && existing.IsActive)
                {
                    existing.IsActive = false;
                    existing.UpdatedAt = DateTimeOffset.UtcNow;
                }
                continue;
            }

            if (existing == null)
            {
                var newUser = new User
                {
                    Id = acc.Id,
                    FullName = acc.Name,
                    Email = acc.Email,
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(acc.Password),
                    Role = acc.Role,
                    IsActive = true,
                    CreatedAt = DateTimeOffset.UtcNow,
                    UpdatedAt = DateTimeOffset.UtcNow
                };
                context.Users.Add(newUser);
            }
            else
            {
                existing.FullName = acc.Name;
                existing.IsActive = true;
                existing.PasswordHash = BCrypt.Net.BCrypt.HashPassword(acc.Password);
                existing.UpdatedAt = DateTimeOffset.UtcNow;
            }
        }

        await context.SaveChangesAsync();
        logger.LogInformation("Core user accounts verified and synchronized.");

        // Ensure active assignment queue has starter items for presentation
        var anuUser = await context.Users.FirstOrDefaultAsync(u => u.Email == "sanushusmitha@gmail.com");
        var opUser = await context.Users.FirstOrDefaultAsync(u => u.Email == "staging.analyst@lendguard.internal");

        if (anuUser != null)
        {
            var anuCount = await context.Exceptions.CountAsync(e => e.AssignedTo == anuUser.Id && (e.Status == ExceptionStatus.Open || e.Status == ExceptionStatus.InProgress));
            if (anuCount < 2)
            {
                var unassigned = await context.Exceptions
                    .Where(e => e.AssignedTo == null && e.Status == ExceptionStatus.Open)
                    .Take(3)
                    .ToListAsync();

                foreach (var ex in unassigned)
                {
                    ex.AssignedTo = anuUser.Id;
                    ex.Status = ExceptionStatus.InProgress;
                    ex.UpdatedAt = DateTimeOffset.UtcNow;
                }
                await context.SaveChangesAsync();
                logger.LogInformation("Assigned starter demonstration exceptions to Anu Sushmitha.");
            }
        }

        if (opUser != null)
        {
            var opCount = await context.Exceptions.CountAsync(e => e.AssignedTo == opUser.Id && (e.Status == ExceptionStatus.Open || e.Status == ExceptionStatus.InProgress));
            if (opCount < 2)
            {
                var unassigned = await context.Exceptions
                    .Where(e => e.AssignedTo == null && e.Status == ExceptionStatus.Open)
                    .Take(3)
                    .ToListAsync();

                foreach (var ex in unassigned)
                {
                    ex.AssignedTo = opUser.Id;
                    ex.Status = ExceptionStatus.InProgress;
                    ex.UpdatedAt = DateTimeOffset.UtcNow;
                }
                await context.SaveChangesAsync();
                logger.LogInformation("Assigned starter demonstration exceptions to Staging Operational Analyst.");
            }
        }

        // Ensure reconciliation_policies table exists in relational databases & seed baseline strict policy
        if (context.Database.IsRelational())
        {
            await context.Database.ExecuteSqlRawAsync(@"
                CREATE TABLE IF NOT EXISTS reconciliation_policies (
                    id UUID PRIMARY KEY,
                    profile_id VARCHAR(30) NOT NULL DEFAULT 'strict',
                    amount_tolerance_percent NUMERIC(8,4) NOT NULL DEFAULT 0.0000,
                    fixed_rupee_tolerance NUMERIC(18,2) NOT NULL DEFAULT 0.00,
                    date_slippage_days INTEGER NOT NULL DEFAULT 0,
                    fuzzy_reference_matching BOOLEAN NOT NULL DEFAULT TRUE,
                    fuzzy_threshold INTEGER NOT NULL DEFAULT 85,
                    auto_recon_confidence INTEGER NOT NULL DEFAULT 95,
                    isolation_forest_outlier_threshold NUMERIC(5,2) NOT NULL DEFAULT 0.75,
                    multi_currency_handling BOOLEAN NOT NULL DEFAULT TRUE,
                    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                );");
        }

        if (!await context.ReconciliationPolicies.AnyAsync())
        {
            context.ReconciliationPolicies.Add(new ReconciliationPolicy
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
            });
            await context.SaveChangesAsync();
            logger.LogInformation("Seeded baseline strict reconciliation policy.");
        }

        if (!await context.ImportBatches.AnyAsync())
        {
            await ResetShowcaseDatasetAsync(context, logger);
        }
    }

    public sealed record ShowcaseSeedSummary(
        int TotalTransactions,
        int MatchedTransactions,
        int TotalExceptions,
        int OpenExceptions,
        int ResolvedExceptions,
        int AssignedToAnu,
        int AssignedToOperationalAnalyst,
        int UnassignedOpen);

    public static async Task<ShowcaseSeedSummary> ResetShowcaseDatasetAsync(
        LendGuardDbContext context,
        ILogger logger,
        Guid? actorUserId = null,
        CancellationToken cancellationToken = default)
    {
        var adminUser = await context.Users.FirstOrDefaultAsync(u => u.Email == "staging.admin@lendguard.internal", cancellationToken)
                        ?? await context.Users.FirstOrDefaultAsync(u => u.Role == UserRole.Admin && u.IsActive, cancellationToken)
                        ?? throw new InvalidOperationException("No active admin user available to own seeded showcase batches.");
        var anuUser = await context.Users.FirstOrDefaultAsync(u => u.Email == "sanushusmitha@gmail.com", cancellationToken);
        var opUser = await context.Users.FirstOrDefaultAsync(u => u.Email == "staging.analyst@lendguard.internal", cancellationToken);
        var starterId = actorUserId ?? adminUser.Id;

        // 1. Purge accumulated smoke-test / duplicate operational rows in FK-safe dependency order (preserving users, policies, audit_logs).
        Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction? dbTx = null;
        if (context.Database.IsRelational())
        {
            dbTx = await context.Database.BeginTransactionAsync(cancellationToken);
            await context.Database.ExecuteSqlRawAsync(@"
                ALTER TABLE investigation_notes DISABLE TRIGGER trg_investigation_notes_immutable;
                DELETE FROM ai_analyses;
                DELETE FROM investigation_notes;
                DELETE FROM exceptions;
                DELETE FROM reconciliation_match_items;
                DELETE FROM reconciliation_matches;
                DELETE FROM reconciliation_runs;
                DELETE FROM background_jobs;
                DELETE FROM import_row_errors;
                DELETE FROM transactions;
                DELETE FROM import_batches;
                ALTER TABLE investigation_notes ENABLE TRIGGER trg_investigation_notes_immutable;
            ", cancellationToken);
        }
        else
        {
            context.AiAnalyses.RemoveRange(await context.AiAnalyses.ToListAsync(cancellationToken));
            context.InvestigationNotes.RemoveRange(await context.InvestigationNotes.ToListAsync(cancellationToken));
            context.Exceptions.RemoveRange(await context.Exceptions.ToListAsync(cancellationToken));
            context.ReconciliationMatchItems.RemoveRange(await context.ReconciliationMatchItems.ToListAsync(cancellationToken));
            context.ReconciliationMatches.RemoveRange(await context.ReconciliationMatches.ToListAsync(cancellationToken));
            context.ReconciliationRuns.RemoveRange(await context.ReconciliationRuns.ToListAsync(cancellationToken));
            context.BackgroundJobs.RemoveRange(await context.BackgroundJobs.ToListAsync(cancellationToken));
            context.ImportRowErrors.RemoveRange(await context.ImportRowErrors.ToListAsync(cancellationToken));
            context.Transactions.RemoveRange(await context.Transactions.ToListAsync(cancellationToken));
            context.ImportBatches.RemoveRange(await context.ImportBatches.ToListAsync(cancellationToken));
            await context.SaveChangesAsync(cancellationToken);
        }

        var now = DateTimeOffset.UtcNow;
        var day4 = now.AddDays(-4);
        var day2 = now.AddDays(-2);
        var day1 = now.AddDays(-1);
        var today = now;

        var batches = new List<ImportBatch>();
        var rowErrors = new List<ImportRowError>();
        var txns = new List<Transaction>();
        var runs = new List<ReconciliationRun>();
        var matches = new List<ReconciliationMatch>();
        var exceptions = new List<DiscrepancyException>();
        var notes = new List<InvestigationNote>();
        var analyses = new List<AiAnalysis>();

        Transaction MakeTxn(Guid batchId, int rowNum, string tRef, string? eRef, DateTimeOffset date, decimal amt, string curr, string tType, string side, string status) => new()
        {
            Id = Guid.NewGuid(),
            ImportBatchId = batchId,
            SourceRowNumber = rowNum,
            TransactionReference = tRef,
            ExternalReference = eRef,
            TransactionDate = date,
            Amount = amt,
            Currency = curr,
            TransactionType = tType,
            SourceType = side,
            Status = status,
            RawData = JsonSerializer.Serialize(new
            {
                transaction_reference = tRef,
                external_reference = eRef ?? "",
                transaction_date = date.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                amount = amt.ToString("F2"),
                currency = curr,
                transaction_type = tType
            }),
            CreatedAt = date
        };

        void AddExactPair(Guid intBatchId, Guid extBatchId, Guid runId, ref int intRow, ref int extRow, string iRef, string eRef, decimal amt, string curr, DateTimeOffset dt, string txnType = "REPAYMENT")
        {
            var iTxn = MakeTxn(intBatchId, intRow++, iRef, eRef, dt, amt, curr, txnType, SourceType.Internal, TransactionStatus.Matched);
            var eTxn = MakeTxn(extBatchId, extRow++, eRef, iRef, dt, amt, curr, "SETTLEMENT", SourceType.External, TransactionStatus.Matched);
            txns.Add(iTxn);
            txns.Add(eTxn);
            matches.Add(new ReconciliationMatch
            {
                Id = Guid.NewGuid(),
                ReconciliationRunId = runId,
                MatchType = Domain.MatchType.Exact,
                Confidence = 100.00m,
                Evidence = JsonSerializer.Serialize(new
                {
                    referenceMatch = true,
                    amountMatch = true,
                    currencyMatch = true,
                    internalAmount = amt,
                    externalAmount = amt,
                    currency = curr,
                    dateDifferenceDays = 0
                }),
                CreatedAt = dt,
                MatchItems = new List<ReconciliationMatchItem>
                {
                    new() { Id = Guid.NewGuid(), TransactionId = iTxn.Id, Side = SourceType.Internal, AmountApplied = amt },
                    new() { Id = Guid.NewGuid(), TransactionId = eTxn.Id, Side = SourceType.External, AmountApplied = amt }
                }
            });
        }

        // =====================================================================
        // DAY -4 PORTFOLIO: 15 Internal + 15 External = 30 txns | 26 Matched (86.7%) | 3 Resolved Exceptions
        // =====================================================================
        var b1Int = new ImportBatch
        {
            Id = Guid.NewGuid(),
            BatchReference = $"IMP-{day4:yyyyMMdd}-001",
            SourceType = SourceType.Internal,
            FileName = "commercial_term_loans_nov21.csv",
            FilePath = "storage_staging/seeded/commercial_term_loans_nov21.csv",
            FileHash = "sha256-demo-nov21-int",
            TotalRows = 15,
            ValidRows = 15,
            Status = ImportBatchStatus.Imported,
            UploadedBy = adminUser.Id,
            CreatedAt = day4,
            ConfirmedAt = day4
        };
        var b1Ext = new ImportBatch
        {
            Id = Guid.NewGuid(),
            BatchReference = $"IMP-{day4:yyyyMMdd}-002",
            SourceType = SourceType.External,
            FileName = "nach_settlements_nov21.csv",
            FilePath = "storage_staging/seeded/nach_settlements_nov21.csv",
            FileHash = "sha256-demo-nov21-ext",
            TotalRows = 15,
            ValidRows = 15,
            Status = ImportBatchStatus.Imported,
            UploadedBy = adminUser.Id,
            CreatedAt = day4,
            ConfirmedAt = day4
        };
        batches.AddRange(b1Int, b1Ext);

        var run1 = new ReconciliationRun
        {
            Id = Guid.NewGuid(),
            InternalBatchId = b1Int.Id,
            ExternalBatchId = b1Ext.Id,
            Status = ReconciliationRunStatus.Completed,
            TotalInternal = 15,
            TotalExternal = 15,
            MatchedCount = 13,
            ExceptionCount = 3,
            StartedBy = starterId,
            RuleVersion = "v2;d=0;p=0;c=0",
            StartedAt = day4.AddMinutes(1),
            CompletedAt = day4.AddMinutes(1).AddSeconds(2)
        };
        runs.Add(run1);

        int r1Int = 1, r1Ext = 1;
        decimal[] day4Amounts = { 25000m, 32000m, 18500m, 44000m, 12750m, 60000m, 22500m, 38000m, 15200m, 29000m, 51000m, 19800m, 27500m };
        for (int i = 0; i < day4Amounts.Length; i++)
        {
            var seq = (1001 + i).ToString();
            AddExactPair(b1Int.Id, b1Ext.Id, run1.Id, ref r1Int, ref r1Ext, $"LN-TERM-{seq}", $"BNK-NACH-{seq}", day4Amounts[i], "INR", day4, i % 3 == 0 ? "DISBURSEMENT" : "REPAYMENT");
        }

        // Day -4 Resolved #1: AMOUNT_MISMATCH (42,000 vs 41,750 -> diff 250.00 INR)
        var d4IntFee = MakeTxn(b1Int.Id, r1Int++, "LN-FEE-1014", "BNK-FEE-1014", day4, 42000.00m, "INR", "REPAYMENT", SourceType.Internal, TransactionStatus.Exception);
        var d4ExtFee = MakeTxn(b1Ext.Id, r1Ext++, "BNK-FEE-1014", "LN-FEE-1014", day4, 41750.00m, "INR", "SETTLEMENT", SourceType.External, TransactionStatus.Exception);
        txns.AddRange(d4IntFee, d4ExtFee);
        exceptions.Add(new DiscrepancyException
        {
            Id = Guid.NewGuid(),
            ReconciliationRunId = run1.Id,
            InternalTransactionId = d4IntFee.Id,
            ExternalTransactionId = d4ExtFee.Id,
            ExceptionType = ExceptionType.AmountMismatch,
            Severity = ExceptionSeverity.Low,
            Status = ExceptionStatus.Resolved,
            ExpectedAmount = 42000.00m,
            ActualAmount = 41750.00m,
            DiscrepancyAmount = 250.00m,
            AssignedTo = opUser?.Id,
            ResolvedBy = opUser?.Id ?? adminUser.Id,
            ResolutionCategory = "FEE_ADJUSTMENT",
            ResolutionExplanation = "Confirmed INR 250.00 NEFT correspondent processing deduction on settlement advice.",
            CreatedAt = day4.AddMinutes(2),
            UpdatedAt = day4.AddHours(2),
            ResolvedAt = day4.AddHours(2)
        });

        // Day -4 Resolved #2: MISSING_SETTLEMENT (6,500.00 INR)
        var d4IntMis = MakeTxn(b1Int.Id, r1Int++, "LN-ACH-1015", null, day4, 6500.00m, "INR", "REPAYMENT", SourceType.Internal, TransactionStatus.Exception);
        txns.Add(d4IntMis);
        exceptions.Add(new DiscrepancyException
        {
            Id = Guid.NewGuid(),
            ReconciliationRunId = run1.Id,
            InternalTransactionId = d4IntMis.Id,
            ExceptionType = ExceptionType.MissingSettlement,
            Severity = ExceptionSeverity.Medium,
            Status = ExceptionStatus.Resolved,
            ExpectedAmount = 6500.00m,
            DiscrepancyAmount = 6500.00m,
            AssignedTo = anuUser?.Id,
            ResolvedBy = anuUser?.Id ?? adminUser.Id,
            ResolutionCategory = "EXPLAINED_TIMING_DIFFERENCE",
            ResolutionExplanation = "Verified T+1 NACH cutoff clearing arrival in next settlement cycle.",
            CreatedAt = day4.AddMinutes(2),
            UpdatedAt = day4.AddHours(3),
            ResolvedAt = day4.AddHours(3)
        });

        // Day -4 Resolved #3: UNMATCHED_EXTERNAL (3,200.00 INR)
        var d4ExtOrph = MakeTxn(b1Ext.Id, r1Ext++, "BNK-UNID-1016", "UNREF-1016", day4, 3200.00m, "INR", "SETTLEMENT", SourceType.External, TransactionStatus.Exception);
        txns.Add(d4ExtOrph);
        exceptions.Add(new DiscrepancyException
        {
            Id = Guid.NewGuid(),
            ReconciliationRunId = run1.Id,
            ExternalTransactionId = d4ExtOrph.Id,
            ExceptionType = ExceptionType.UnmatchedExternal,
            Severity = ExceptionSeverity.Low,
            Status = ExceptionStatus.Resolved,
            ActualAmount = 3200.00m,
            DiscrepancyAmount = 3200.00m,
            AssignedTo = opUser?.Id,
            ResolvedBy = opUser?.Id ?? adminUser.Id,
            ResolutionCategory = "MANUAL_ADJUSTMENT",
            ResolutionExplanation = "Matched borrower advance escrow deposit manually via UTR receipt.",
            CreatedAt = day4.AddMinutes(2),
            UpdatedAt = day4.AddHours(4),
            ResolvedAt = day4.AddHours(4)
        });

        // =====================================================================
        // DAY -2 PORTFOLIO: 16 Internal + 17 External = 33 txns | 27 Matched (12 Exact + 1 Agg, 81.8%) | 4 Exceptions
        // =====================================================================
        var b2Int = new ImportBatch
        {
            Id = Guid.NewGuid(),
            BatchReference = $"IMP-{day2:yyyyMMdd}-001",
            SourceType = SourceType.Internal,
            FileName = "retail_emi_ledger_nov23.csv",
            FilePath = "storage_staging/seeded/retail_emi_ledger_nov23.csv",
            FileHash = "sha256-demo-nov23-int",
            TotalRows = 16,
            ValidRows = 16,
            Status = ImportBatchStatus.Imported,
            UploadedBy = adminUser.Id,
            CreatedAt = day2,
            ConfirmedAt = day2
        };
        var b2Ext = new ImportBatch
        {
            Id = Guid.NewGuid(),
            BatchReference = $"IMP-{day2:yyyyMMdd}-002",
            SourceType = SourceType.External,
            FileName = "gateway_upi_neft_nov23.csv",
            FilePath = "storage_staging/seeded/gateway_upi_neft_nov23.csv",
            FileHash = "sha256-demo-nov23-ext",
            TotalRows = 17,
            ValidRows = 17,
            Status = ImportBatchStatus.Imported,
            UploadedBy = adminUser.Id,
            CreatedAt = day2,
            ConfirmedAt = day2
        };
        batches.AddRange(b2Int, b2Ext);

        var run2 = new ReconciliationRun
        {
            Id = Guid.NewGuid(),
            InternalBatchId = b2Int.Id,
            ExternalBatchId = b2Ext.Id,
            Status = ReconciliationRunStatus.Completed,
            TotalInternal = 16,
            TotalExternal = 17,
            MatchedCount = 13,
            ExceptionCount = 4,
            StartedBy = starterId,
            RuleVersion = "v2;d=0;p=0;c=0",
            StartedAt = day2.AddMinutes(1),
            CompletedAt = day2.AddMinutes(1).AddSeconds(2)
        };
        runs.Add(run2);

        int r2Int = 1, r2Ext = 1;
        decimal[] day2Amounts = { 14200m, 19500m, 28000m, 33500m, 16800m, 41200m, 23400m, 37600m, 11900m, 48500m, 26700m, 31000m };
        for (int i = 0; i < day2Amounts.Length; i++)
        {
            var seq = (2001 + i).ToString();
            AddExactPair(b2Int.Id, b2Ext.Id, run2.Id, ref r2Int, ref r2Ext, $"LN-EMI-{seq}", $"GW-UPI-{seq}", day2Amounts[i], "INR", day2);
        }

        // Day -2 Aggregate 1:2 Match (45,000 = 25,000 + 20,000 -> 3 matched txns)
        var aggInt = MakeTxn(b2Int.Id, r2Int++, "LN-CORP-2013", null, day2, 45000.00m, "INR", "REPAYMENT", SourceType.Internal, TransactionStatus.Matched);
        var aggExtA = MakeTxn(b2Ext.Id, r2Ext++, "GW-NEFT-2013A", "LN-CORP-2013", day2, 25000.00m, "INR", "SETTLEMENT", SourceType.External, TransactionStatus.Matched);
        var aggExtB = MakeTxn(b2Ext.Id, r2Ext++, "GW-NEFT-2013B", "LN-CORP-2013", day2, 20000.00m, "INR", "SETTLEMENT", SourceType.External, TransactionStatus.Matched);
        txns.AddRange(aggInt, aggExtA, aggExtB);
        matches.Add(new ReconciliationMatch
        {
            Id = Guid.NewGuid(),
            ReconciliationRunId = run2.Id,
            MatchType = Domain.MatchType.Aggregate,
            Confidence = 95.00m,
            Evidence = JsonSerializer.Serialize(new { referenceMatch = true, aggregateMatch = true, candidateCount = 2, totalAmount = 45000.00m, currency = "INR" }),
            CreatedAt = day2,
            MatchItems = new List<ReconciliationMatchItem>
            {
                new() { Id = Guid.NewGuid(), TransactionId = aggInt.Id, Side = SourceType.Internal, AmountApplied = 45000.00m },
                new() { Id = Guid.NewGuid(), TransactionId = aggExtA.Id, Side = SourceType.External, AmountApplied = 25000.00m },
                new() { Id = Guid.NewGuid(), TransactionId = aggExtB.Id, Side = SourceType.External, AmountApplied = 20000.00m }
            }
        });

        // Day -2 Flagship #1 (Anu): CRITICAL AMOUNT_MISMATCH (40,000.00 - 24,579.50 == 15,420.50 INR)
        var anuIntAmt = MakeTxn(b2Int.Id, r2Int++, "LN-CLRG-2014", "GW-CLRG-2014", day2, 40000.00m, "INR", "REPAYMENT", SourceType.Internal, TransactionStatus.Exception);
        var anuExtAmt = MakeTxn(b2Ext.Id, r2Ext++, "GW-CLRG-2014", "LN-CLRG-2014", day2, 24579.50m, "INR", "SETTLEMENT", SourceType.External, TransactionStatus.Exception);
        txns.AddRange(anuIntAmt, anuExtAmt);
        var exAnu1 = new DiscrepancyException
        {
            Id = Guid.NewGuid(),
            ReconciliationRunId = run2.Id,
            InternalTransactionId = anuIntAmt.Id,
            ExternalTransactionId = anuExtAmt.Id,
            ExceptionType = ExceptionType.AmountMismatch,
            Severity = ExceptionSeverity.Critical,
            Status = anuUser != null ? ExceptionStatus.InProgress : ExceptionStatus.Open,
            ExpectedAmount = 40000.00m,
            ActualAmount = 24579.50m,
            DiscrepancyAmount = 15420.50m,
            AssignedTo = anuUser?.Id,
            CreatedAt = day2.AddMinutes(3),
            UpdatedAt = day2.AddMinutes(10)
        };
        exceptions.Add(exAnu1);

        // Day -2 Flagship #2 (Anu): HIGH MISSING_SETTLEMENT (8,500.00 INR)
        var anuIntMis = MakeTxn(b2Int.Id, r2Int++, "LN-MIS-2015", null, day2, 8500.00m, "INR", "REPAYMENT", SourceType.Internal, TransactionStatus.Exception);
        txns.Add(anuIntMis);
        var exAnu2 = new DiscrepancyException
        {
            Id = Guid.NewGuid(),
            ReconciliationRunId = run2.Id,
            InternalTransactionId = anuIntMis.Id,
            ExceptionType = ExceptionType.MissingSettlement,
            Severity = ExceptionSeverity.High,
            Status = anuUser != null ? ExceptionStatus.InProgress : ExceptionStatus.Open,
            ExpectedAmount = 8500.00m,
            DiscrepancyAmount = 8500.00m,
            AssignedTo = anuUser?.Id,
            CreatedAt = day2.AddMinutes(4),
            UpdatedAt = day2.AddMinutes(10)
        };
        exceptions.Add(exAnu2);

        // Day -2 LOW AMOUNT_MISMATCH (12,000.00 vs 11,925.00 -> diff 75.00 INR, unassigned OPEN)
        var lowIntVar = MakeTxn(b2Int.Id, r2Int++, "LN-VAR-2016", "GW-VAR-2016", day2, 12000.00m, "INR", "REPAYMENT", SourceType.Internal, TransactionStatus.Exception);
        var lowExtVar = MakeTxn(b2Ext.Id, r2Ext++, "GW-VAR-2016", "LN-VAR-2016", day2, 11925.00m, "INR", "SETTLEMENT", SourceType.External, TransactionStatus.Exception);
        txns.AddRange(lowIntVar, lowExtVar);
        exceptions.Add(new DiscrepancyException
        {
            Id = Guid.NewGuid(),
            ReconciliationRunId = run2.Id,
            InternalTransactionId = lowIntVar.Id,
            ExternalTransactionId = lowExtVar.Id,
            ExceptionType = ExceptionType.AmountMismatch,
            Severity = ExceptionSeverity.Low,
            Status = ExceptionStatus.Open,
            ExpectedAmount = 12000.00m,
            ActualAmount = 11925.00m,
            DiscrepancyAmount = 75.00m,
            CreatedAt = day2.AddMinutes(5),
            UpdatedAt = day2.AddMinutes(5)
        });

        // Day -2 Flagship #3 (Operational Analyst): HIGH UNMATCHED_EXTERNAL (5,200.00 INR)
        var opExtOrph = MakeTxn(b2Ext.Id, r2Ext++, "GW-ORPH-2017", "UNMATCHED-UTR-2017", day2, 5200.00m, "INR", "SETTLEMENT", SourceType.External, TransactionStatus.Exception);
        txns.Add(opExtOrph);
        var exOp1 = new DiscrepancyException
        {
            Id = Guid.NewGuid(),
            ReconciliationRunId = run2.Id,
            ExternalTransactionId = opExtOrph.Id,
            ExceptionType = ExceptionType.UnmatchedExternal,
            Severity = ExceptionSeverity.High,
            Status = opUser != null ? ExceptionStatus.InProgress : ExceptionStatus.Open,
            ActualAmount = 5200.00m,
            DiscrepancyAmount = 5200.00m,
            AssignedTo = opUser?.Id,
            CreatedAt = day2.AddMinutes(6),
            UpdatedAt = day2.AddMinutes(10)
        };
        exceptions.Add(exOp1);

        // =====================================================================
        // TODAY PORTFOLIO: 17 Internal + 20 External = 37 txns | 26 Matched (13 Exact, 70.3%) | 6 Exceptions
        // =====================================================================
        var b3Int = new ImportBatch
        {
            Id = Guid.NewGuid(),
            BatchReference = $"IMP-{today:yyyyMMdd}-001",
            SourceType = SourceType.Internal,
            FileName = "treasury_rtgs_fx_nov25.csv",
            FilePath = "storage_staging/seeded/treasury_rtgs_fx_nov25.csv",
            FileHash = "sha256-demo-nov25-int",
            TotalRows = 17,
            ValidRows = 17,
            Status = ImportBatchStatus.Imported,
            UploadedBy = adminUser.Id,
            CreatedAt = today,
            ConfirmedAt = today
        };
        var b3Ext = new ImportBatch
        {
            Id = Guid.NewGuid(),
            BatchReference = $"IMP-{today:yyyyMMdd}-002",
            SourceType = SourceType.External,
            FileName = "bank_rtgs_swift_nov25.csv",
            FilePath = "storage_staging/seeded/bank_rtgs_swift_nov25.csv",
            FileHash = "sha256-demo-nov25-ext",
            TotalRows = 20,
            ValidRows = 20,
            Status = ImportBatchStatus.Imported,
            UploadedBy = adminUser.Id,
            CreatedAt = today,
            ConfirmedAt = today
        };
        batches.AddRange(b3Int, b3Ext);

        // Include 1 unconfirmed VALIDATION_COMPLETED batch dated Day -1 to demonstrate validation error workflow without polluting active ledger totals
        var bVal = new ImportBatch
        {
            Id = Guid.NewGuid(),
            BatchReference = $"IMP-{day1:yyyyMMdd}-VAL",
            SourceType = SourceType.Internal,
            FileName = "partner_feed_staging_review.csv",
            FilePath = "storage_staging/seeded/partner_feed_staging_review.csv",
            FileHash = "sha256-demo-nov24-val",
            TotalRows = 5,
            ValidRows = 4,
            RejectedRows = 1,
            DuplicateRows = 0,
            Status = ImportBatchStatus.ValidationCompleted,
            UploadedBy = adminUser.Id,
            CreatedAt = day1
        };
        batches.Add(bVal);
        rowErrors.Add(new ImportRowError
        {
            Id = Guid.NewGuid(),
            ImportBatchId = bVal.Id,
            RowNumber = 5,
            FieldName = "amount",
            ErrorCode = "INVALID_DECIMAL",
            ErrorMessage = "Amount must be a positive decimal currency value.",
            RawRow = "{\"transaction_reference\":\"LN-ERR-905\",\"amount\":\"TBD\"}"
        });

        var run3 = new ReconciliationRun
        {
            Id = Guid.NewGuid(),
            InternalBatchId = b3Int.Id,
            ExternalBatchId = b3Ext.Id,
            Status = ReconciliationRunStatus.Completed,
            TotalInternal = 17,
            TotalExternal = 20,
            MatchedCount = 13,
            ExceptionCount = 6,
            StartedBy = starterId,
            RuleVersion = "v2;d=0;p=0;c=0",
            StartedAt = today.AddMinutes(-15),
            CompletedAt = today.AddMinutes(-15).AddSeconds(2)
        };
        runs.Add(run3);

        int r3Int = 1, r3Ext = 1;
        decimal[] day0Amounts = { 55000m, 42000m, 31500m, 18000m, 64000m, 27500m, 49000m, 36000m, 21000m, 44500m, 29800m, 53000m };
        for (int i = 0; i < day0Amounts.Length; i++)
        {
            var seq = (3001 + i).ToString();
            AddExactPair(b3Int.Id, b3Ext.Id, run3.Id, ref r3Int, ref r3Ext, $"LN-RTGS-{seq}", $"BNK-RTGS-{seq}", day0Amounts[i], "INR", today, i % 4 == 0 ? "DISBURSEMENT" : "REPAYMENT");
        }
        // Multi-currency USD exact match
        AddExactPair(b3Int.Id, b3Ext.Id, run3.Id, ref r3Int, ref r3Ext, "LN-FX-3013", "BNK-FX-3013", 1200.00m, "USD", today, "FEE");

        // Today Flagship #4 (Operational Analyst): MEDIUM PARTIAL_SETTLEMENT (25,000 vs 15,000 + 8,750 = 23,750 -> diff 1,250.00 INR)
        var partInt = MakeTxn(b3Int.Id, r3Int++, "LN-TRN-3014", null, today, 25000.00m, "INR", "REPAYMENT", SourceType.Internal, TransactionStatus.Exception);
        var partExtA = MakeTxn(b3Ext.Id, r3Ext++, "BNK-TRN-3014A", "LN-TRN-3014", today, 15000.00m, "INR", "SETTLEMENT", SourceType.External, TransactionStatus.Exception);
        var partExtB = MakeTxn(b3Ext.Id, r3Ext++, "BNK-TRN-3014B", "LN-TRN-3014", today, 8750.00m, "INR", "SETTLEMENT", SourceType.External, TransactionStatus.Exception);
        txns.AddRange(partInt, partExtA, partExtB);
        var exOp2 = new DiscrepancyException
        {
            Id = Guid.NewGuid(),
            ReconciliationRunId = run3.Id,
            InternalTransactionId = partInt.Id,
            ExternalTransactionId = partExtA.Id,
            ExceptionType = ExceptionType.PartialSettlement,
            Severity = ExceptionSeverity.Medium,
            Status = opUser != null ? ExceptionStatus.InProgress : ExceptionStatus.Open,
            ExpectedAmount = 25000.00m,
            ActualAmount = 23750.00m,
            DiscrepancyAmount = 1250.00m,
            AssignedTo = opUser?.Id,
            CreatedAt = today.AddMinutes(-12),
            UpdatedAt = today.AddMinutes(-10)
        };
        exceptions.Add(exOp2);

        // Today Flagship #5 (Unassigned Outlier): CRITICAL AMBIGUOUS_MATCH (75,000 vs 60,000 + 60,000 = 120,000 -> diff 45,000.00 INR)
        var ambInt = MakeTxn(b3Int.Id, r3Int++, "LN-AMB-3015", null, today, 75000.00m, "INR", "REPAYMENT", SourceType.Internal, TransactionStatus.Exception);
        var ambExtA = MakeTxn(b3Ext.Id, r3Ext++, "BNK-AMB-3015A", "LN-AMB-3015", today, 60000.00m, "INR", "SETTLEMENT", SourceType.External, TransactionStatus.Exception);
        var ambExtB = MakeTxn(b3Ext.Id, r3Ext++, "BNK-AMB-3015B", "LN-AMB-3015", today, 60000.00m, "INR", "SETTLEMENT", SourceType.External, TransactionStatus.Exception);
        txns.AddRange(ambInt, ambExtA, ambExtB);
        var exOutlier = new DiscrepancyException
        {
            Id = Guid.NewGuid(),
            ReconciliationRunId = run3.Id,
            InternalTransactionId = ambInt.Id,
            ExternalTransactionId = ambExtA.Id,
            ExceptionType = ExceptionType.AmbiguousMatch,
            Severity = ExceptionSeverity.Critical,
            Status = ExceptionStatus.Open,
            ExpectedAmount = 75000.00m,
            ActualAmount = 120000.00m,
            DiscrepancyAmount = 45000.00m,
            CreatedAt = today.AddMinutes(-10),
            UpdatedAt = today.AddMinutes(-10)
        };
        exceptions.Add(exOutlier);

        // Today DUPLICATE pair (10,000 vs 10,000 + 10,000 -> 2 OPEN HIGH DUPLICATE exceptions)
        var dupInt = MakeTxn(b3Int.Id, r3Int++, "LN-DUP-3016", null, today, 10000.00m, "INR", "DISBURSEMENT", SourceType.Internal, TransactionStatus.Exception);
        var dupExtA = MakeTxn(b3Ext.Id, r3Ext++, "BNK-DUP-3016A", "LN-DUP-3016", today, 10000.00m, "INR", "SETTLEMENT", SourceType.External, TransactionStatus.Exception);
        var dupExtB = MakeTxn(b3Ext.Id, r3Ext++, "BNK-DUP-3016B", "LN-DUP-3016", today, 10000.00m, "INR", "SETTLEMENT", SourceType.External, TransactionStatus.Exception);
        txns.AddRange(dupInt, dupExtA, dupExtB);
        exceptions.Add(new DiscrepancyException
        {
            Id = Guid.NewGuid(),
            ReconciliationRunId = run3.Id,
            InternalTransactionId = dupInt.Id,
            ExternalTransactionId = dupExtA.Id,
            ExceptionType = ExceptionType.Duplicate,
            Severity = ExceptionSeverity.High,
            Status = ExceptionStatus.Open,
            ExpectedAmount = 10000.00m,
            ActualAmount = 10000.00m,
            DiscrepancyAmount = 10000.00m,
            CreatedAt = today.AddMinutes(-8),
            UpdatedAt = today.AddMinutes(-8)
        });
        exceptions.Add(new DiscrepancyException
        {
            Id = Guid.NewGuid(),
            ReconciliationRunId = run3.Id,
            InternalTransactionId = dupInt.Id,
            ExternalTransactionId = dupExtB.Id,
            ExceptionType = ExceptionType.Duplicate,
            Severity = ExceptionSeverity.High,
            Status = ExceptionStatus.Open,
            ExpectedAmount = 10000.00m,
            ActualAmount = 10000.00m,
            DiscrepancyAmount = 10000.00m,
            CreatedAt = today.AddMinutes(-7),
            UpdatedAt = today.AddMinutes(-7)
        });

        // Today Multi-currency USD Missing Settlement (500.00 USD)
        var usdIntMis = MakeTxn(b3Int.Id, r3Int++, "LN-FX-3017", null, today, 500.00m, "USD", "FEE", SourceType.Internal, TransactionStatus.Exception);
        txns.Add(usdIntMis);
        exceptions.Add(new DiscrepancyException
        {
            Id = Guid.NewGuid(),
            ReconciliationRunId = run3.Id,
            InternalTransactionId = usdIntMis.Id,
            ExceptionType = ExceptionType.MissingSettlement,
            Severity = ExceptionSeverity.Low,
            Status = ExceptionStatus.Open,
            ExpectedAmount = 500.00m,
            DiscrepancyAmount = 500.00m,
            CreatedAt = today.AddMinutes(-6),
            UpdatedAt = today.AddMinutes(-6)
        });

        // Today Multi-currency EUR Unmatched External (500.00 EUR)
        var eurExtUnm = MakeTxn(b3Ext.Id, r3Ext++, "BNK-EUR-3018", "SWIFT-EUR-3018", today, 500.00m, "EUR", "SETTLEMENT", SourceType.External, TransactionStatus.Exception);
        txns.Add(eurExtUnm);
        exceptions.Add(new DiscrepancyException
        {
            Id = Guid.NewGuid(),
            ReconciliationRunId = run3.Id,
            ExternalTransactionId = eurExtUnm.Id,
            ExceptionType = ExceptionType.UnmatchedExternal,
            Severity = ExceptionSeverity.Medium,
            Status = ExceptionStatus.Open,
            ActualAmount = 500.00m,
            DiscrepancyAmount = 500.00m,
            CreatedAt = today.AddMinutes(-5),
            UpdatedAt = today.AddMinutes(-5)
        });

        // Seed consistent initial Investigation Notes & AI Diagnostics for flagship exceptions
        if (anuUser != null)
        {
            notes.Add(new InvestigationNote
            {
                Id = Guid.NewGuid(),
                ExceptionId = exAnu1.Id,
                UserId = anuUser.Id,
                Note = "Assigned to treasury operations: INR 40,000.00 expected vs INR 24,579.50 received (INR 15,420.50 shortfall). Checking gateway withholding advice.",
                CreatedAt = day2.AddMinutes(15)
            });
        }
        if (opUser != null)
        {
            notes.Add(new InvestigationNote
            {
                Id = Guid.NewGuid(),
                ExceptionId = exOp2.Id,
                UserId = opUser.Id,
                Note = "Two partial settlement tranches received (INR 15,000.00 + INR 8,750.00 = INR 23,750.00); tracing remaining INR 1,250.00 retention.",
                CreatedAt = today.AddMinutes(-9)
            });
        }

        void AddFlagshipAi(Guid excId, decimal anomalyScore, string riskLevel, string[] signals, decimal devAmt, double relPct, string curr, bool isSingleSided, string summaryText, string recText)
        {
            analyses.Add(new AiAnalysis
            {
                Id = Guid.NewGuid(),
                ExceptionId = excId,
                AnalysisType = AiAnalysisType.Anomaly,
                ModelName = "scikit-learn/isolation-forest-v2.0-enterprise",
                ModelVersion = "2.0",
                Status = AiAnalysisStatus.Completed,
                CreatedAt = today.AddMinutes(-4),
                CompletedAt = today.AddMinutes(-4),
                Result = JsonSerializer.Serialize(new
                {
                    summary = $"Anomaly Risk Score: {anomalyScore:P0} ({riskLevel} Risk). IsolationForest evaluated multi-dimensional transaction features.",
                    evidence = new
                    {
                        anomalyScore,
                        riskLevel,
                        signals,
                        algorithm = "Tri-Model Outlier Ensemble (iForest + Robust Covariance)",
                        featureAttributions = new[]
                        {
                            new { feature = "Discrepancy Magnitude", contributionPct = 48, rawMetric = $"{curr} {devAmt:N2}", impactDirection = "INCREASES_ANOMALY" },
                            new { feature = "Relative Variance Ratio", contributionPct = 34, rawMetric = $"{relPct:0.0}%", impactDirection = "INCREASES_ANOMALY" },
                            new { feature = "Settlement Date Slippage", contributionPct = 6, rawMetric = "0.0 days", impactDirection = "NORMAL_RANGE" },
                            new { feature = "Counterparty Reconciliation Gap", contributionPct = 12, rawMetric = isSingleSided ? "Single-Sided Unmatched" : "Dual-Sided Matched", impactDirection = isSingleSided ? "INCREASES_ANOMALY" : "NORMAL_RANGE" }
                        },
                        ensembleWeights = new { isolationForest = 0.55, robustMahalanobis = 0.45 },
                        advisoryOnly = true
                    },
                    recommendation = anomalyScore >= 0.70m
                        ? "High anomaly risk: Prioritize immediate manual ledger reconciliation and settlement voucher inspection."
                        : "Moderate-to-low risk: Standard operational workflow verification is sufficient.",
                    advisoryOnly = true
                })
            });

            analyses.Add(new AiAnalysis
            {
                Id = Guid.NewGuid(),
                ExceptionId = excId,
                AnalysisType = AiAnalysisType.Explanation,
                ModelName = "evidence-explainer-v1",
                ModelVersion = "1.0",
                Status = AiAnalysisStatus.Completed,
                CreatedAt = today.AddMinutes(-4),
                CompletedAt = today.AddMinutes(-4),
                Result = JsonSerializer.Serialize(new
                {
                    summary = summaryText,
                    evidence = new { currency = curr, variance = devAmt },
                    recommendation = recText,
                    advisoryOnly = true
                })
            });
        }

        AddFlagshipAi(
            exAnu1.Id, 0.89m, "CRITICAL", new[] { "CRITICAL_AMOUNT_DEVIATION" }, 15420.50m, 38.6, "INR", false,
            "Internal expected repayment of INR 40,000.00 differs from external settlement of INR 24,579.50 by INR 15,420.50 (38.6% variance).",
            "Request gateway settlement advice and verify chargeback or tax/fee withholdings before posting adjustment journal.");

        AddFlagshipAi(
            exAnu2.Id, 0.76m, "HIGH", new[] { "CRITICAL_AMOUNT_DEVIATION", "COUNTERPARTY_RECONCILIATION_GAP" }, 8500.00m, 100.0, "INR", true,
            "Internal loan repayment LN-MIS-2015 for INR 8,500.00 has no corresponding external bank settlement in the clearing feed.",
            "Confirm settlement batch cutoff timing or obtain UTR trace from payment gateway.");

        AddFlagshipAi(
            exOp1.Id, 0.73m, "HIGH", new[] { "CRITICAL_AMOUNT_DEVIATION", "COUNTERPARTY_RECONCILIATION_GAP" }, 5200.00m, 100.0, "INR", true,
            "External settlement GW-ORPH-2017 of INR 5,200.00 arrived with unmapped reference UNMATCHED-UTR-2017 and no internal loan entry.",
            "Trace UTR sender metadata to allocate deposit or hold in Unidentified Remittance Suspense.");

        AddFlagshipAi(
            exOp2.Id, 0.56m, "MODERATE", new[] { "MODERATE_AMOUNT_DEVIATION" }, 1250.00m, 5.0, "INR", false,
            "Two partial external tranches totaling INR 23,750.00 (15,000.00 + 8,750.00) fell short of expected INR 25,000.00 by INR 1,250.00.",
            "Confirm whether remaining INR 1,250.00 tranche is in transit or withheld under gateway settlement fees.");

        AddFlagshipAi(
            exOutlier.Id, 0.94m, "CRITICAL", new[] { "CRITICAL_AMOUNT_DEVIATION" }, 45000.00m, 60.0, "INR", false,
            "Two external settlements totaling INR 120,000.00 (60,000.00 + 60,000.00) matched LN-AMB-3015 expecting INR 75,000.00 (+INR 45,000.00 excess).",
            "Hold excess credit in Clearing Suspense until treasury confirms if a second borrower loan was bundled.");

        context.ImportBatches.AddRange(batches);
        context.ImportRowErrors.AddRange(rowErrors);
        context.Transactions.AddRange(txns);
        context.ReconciliationRuns.AddRange(runs);
        context.ReconciliationMatches.AddRange(matches);
        context.Exceptions.AddRange(exceptions);
        context.InvestigationNotes.AddRange(notes);
        context.AiAnalyses.AddRange(analyses);

        await context.SaveChangesAsync(cancellationToken);
        if (dbTx != null)
        {
            await dbTx.CommitAsync(cancellationToken);
            await dbTx.DisposeAsync();
        }

        int openCount = exceptions.Count(e => e.Status == ExceptionStatus.Open || e.Status == ExceptionStatus.InProgress);
        int resolvedCount = exceptions.Count(e => e.Status == ExceptionStatus.Resolved);
        int anuAssigned = exceptions.Count(e => anuUser != null && e.AssignedTo == anuUser.Id && e.Status != ExceptionStatus.Resolved);
        int opAssigned = exceptions.Count(e => opUser != null && e.AssignedTo == opUser.Id && e.Status != ExceptionStatus.Resolved);
        int unassignedOpen = exceptions.Count(e => e.AssignedTo == null && e.Status == ExceptionStatus.Open);
        int matchedTxns = txns.Count(t => t.Status == TransactionStatus.Matched);

        logger.LogInformation("Showcase dataset reset cleanly: {Txns} transactions ({Matched} matched), {Exc} exceptions.", txns.Count, matchedTxns, exceptions.Count);

        return new ShowcaseSeedSummary(
            txns.Count,
            matchedTxns,
            exceptions.Count,
            openCount,
            resolvedCount,
            anuAssigned,
            opAssigned,
            unassignedOpen);
    }
}
