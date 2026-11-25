export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  role: 'ADMIN' | 'ANALYST';
}

export interface LoginResponse {
  accessToken: string;
  expiresAt: string;
  user: UserProfile;
}

export interface UserSummary {
  id: string;
  fullName: string;
  email: string;
  role: 'ADMIN' | 'ANALYST';
  isActive: boolean;
  createdAt: string;
}

export interface UserDetail extends UserSummary {
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface ImportBatchSummary {
  id: string;
  batchReference: string;
  sourceType: 'INTERNAL' | 'EXTERNAL';
  fileName: string;
  totalRows: number;
  validRows: number;
  rejectedRows: number;
  duplicateRows: number;
  status: string;
  createdAt: string;
}

export interface ImportBatchDetail extends ImportBatchSummary {
  uploadedBy: UserProfile;
  confirmedAt?: string;
}

export interface ImportRowError {
  rowNumber: number;
  fieldName?: string;
  errorCode: string;
  errorMessage: string;
  rawRow?: string;
}

export interface ValidationResult {
  batchId: string;
  totalRows: number;
  validRows: number;
  rejectedRows: number;
  duplicateRows: number;
  errors: ImportRowError[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface TransactionSummary {
  id: string;
  transactionReference: string;
  externalReference?: string;
  transactionDate: string;
  amount: number;
  currency: string;
  transactionType?: string;
  sourceType: 'INTERNAL' | 'EXTERNAL';
  status: string;
  importBatchId: string;
}

export interface TransactionDetail extends TransactionSummary {
  batchReference?: string;
  rawData: string;
  relatedMatchIds: string[];
  relatedExceptionIds: string[];
}

export interface ReconciliationRunSummary {
  id: string;
  status: string;
  internalBatchId: string;
  externalBatchId: string;
  matchedCount: number;
  exceptionCount: number;
  startedAt: string;
  completedAt?: string;
}

export interface ReconciliationRunDetail extends ReconciliationRunSummary {
  internalBatchReference?: string;
  externalBatchReference?: string;
  totalInternal: number;
  totalExternal: number;
  ruleVersion: string;
  failureCode?: string;
  failureMessage?: string;
}

export interface MatchMember {
  transactionId: string;
  side: string;
  amountApplied: number;
  transactionReference?: string;
}

export interface MatchItem {
  id: string;
  matchType: string;
  confidence?: number;
  members: MatchMember[];
  evidence: any;
}

export interface ExceptionSummary {
  id: string;
  exceptionType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  discrepancyAmount?: number;
  currency: string;
  assignedTo?: UserProfile;
  createdAt: string;
}

export interface ExceptionDetail {
  id: string;
  exceptionType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  expectedAmount?: number;
  actualAmount?: number;
  discrepancyAmount?: number;
  currency: string;
  internalTransactionId?: string;
  externalTransactionId?: string;
  assignedTo?: UserProfile;
  evidence: any;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  resolutionCategory?: string;
  resolutionExplanation?: string;
  resolvedBy?: UserProfile;
  internalTransaction?: TransactionSummary;
  externalTransaction?: TransactionSummary;
}

export interface InvestigationNote {
  id: string;
  exceptionId: string;
  userId: string;
  userName?: string;
  note: string;
  createdAt: string;
}

export interface AnomalyEvidence {
  anomalyScore?: number;
  riskLevel?: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  signals?: string[];
  algorithm?: string;
  modelVersion?: string;
  featureAttributions?: Array<{
    feature: string;
    contributionPct: number;
    rawMetric: string;
    impactDirection: string;
  }>;
  ensembleWeights?: Record<string, number>;
  advisoryOnly?: boolean;
}

export interface AiAnalysis {
  analysisId: string;
  status: string;
  analysisType: 'EXPLANATION' | 'ANOMALY';
  summary?: string;
  evidence?: any;
  recommendation?: string;
  advisoryOnly: boolean;
  modelName?: string;
  createdAt: string;
}

export interface DashboardSummary {
  totalTransactions: number;
  matchedTransactions: number;
  unmatchedTransactions: number;
  openExceptions: number;
  resolvedExceptions: number;
  matchRate: number;
}

export interface DashboardTrendItem {
  period: string;
  total: number;
  matched: number;
  exceptions: number;
  matchRate: number;
}

export interface DashboardTrends {
  interval: string;
  items: DashboardTrendItem[];
}

export interface ReconciliationReport {
  filters: Record<string, string | undefined>;
  totals: {
    runs: number;
    internalTransactions: number;
    externalTransactions: number;
    matched: number;
    exceptions: number;
  };
  matchRate: number;
}

export interface ExceptionReport {
  filters: Record<string, string | undefined>;
  totals: {
    total: number;
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  byType: Array<{ type: string; count: number }>;
}

export interface AuditLog {
  id: string;
  userId?: string;
  actorName?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: any;
  createdAt: string;
}
