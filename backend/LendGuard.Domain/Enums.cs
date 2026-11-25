namespace LendGuard.Domain;

public static class UserRole
{
    public const string Admin = "ADMIN";
    public const string Analyst = "ANALYST";
}

public static class SourceType
{
    public const string Internal = "INTERNAL";
    public const string External = "EXTERNAL";
}

public static class ImportBatchStatus
{
    public const string Received = "RECEIVED";
    public const string Validating = "VALIDATING";
    public const string ValidationCompleted = "VALIDATION_COMPLETED";
    public const string Importing = "IMPORTING";
    public const string Imported = "IMPORTED";
    public const string PartiallyImported = "PARTIALLY_IMPORTED";
    public const string Failed = "FAILED";
    public const string Cancelled = "CANCELLED";
}

public static class TransactionStatus
{
    public const string Pending = "PENDING";
    public const string Matched = "MATCHED";
    public const string Exception = "EXCEPTION";
    public const string Unmatched = "UNMATCHED";
}

public static class ReconciliationRunStatus
{
    public const string Queued = "QUEUED";
    public const string Processing = "PROCESSING";
    public const string Completed = "COMPLETED";
    public const string Failed = "FAILED";
    public const string Cancelled = "CANCELLED";
}

public static class MatchType
{
    public const string Exact = "EXACT";
    public const string Aggregate = "AGGREGATE";
}

public static class ExceptionType
{
    public const string AmountMismatch = "AMOUNT_MISMATCH";
    public const string MissingSettlement = "MISSING_SETTLEMENT";
    public const string UnmatchedExternal = "UNMATCHED_EXTERNAL";
    public const string Duplicate = "DUPLICATE";
    public const string PartialSettlement = "PARTIAL_SETTLEMENT";
    public const string AmbiguousMatch = "AMBIGUOUS_MATCH";
}

public static class ExceptionSeverity
{
    public const string Low = "LOW";
    public const string Medium = "MEDIUM";
    public const string High = "HIGH";
    public const string Critical = "CRITICAL";
}

public static class ExceptionStatus
{
    public const string Open = "OPEN";
    public const string InProgress = "IN_PROGRESS";
    public const string Resolved = "RESOLVED";
}

public static class AiAnalysisStatus
{
    public const string Pending = "PENDING";
    public const string Completed = "COMPLETED";
    public const string Failed = "FAILED";
}

public static class AiAnalysisType
{
    public const string Anomaly = "ANOMALY";
    public const string Explanation = "EXPLANATION";
}

public static class BackgroundJobStatus
{
    public const string Pending = "PENDING";
    public const string Processing = "PROCESSING";
    public const string Completed = "COMPLETED";
    public const string Failed = "FAILED";
    public const string DeadLetter = "DEAD_LETTER";
}

public static class BackgroundJobType
{
    public const string Import = "IMPORT";
    public const string Reconciliation = "RECONCILIATION";
    public const string AiAnalysis = "AI_ANALYSIS";
}
