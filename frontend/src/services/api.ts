import {
  LoginResponse,
  UserProfile,
  UserSummary,
  UserDetail,
  PaginatedResponse,
  ImportBatchSummary,
  ImportBatchDetail,
  ValidationResult,
  TransactionSummary,
  TransactionDetail,
  ReconciliationRunSummary,
  ReconciliationRunDetail,
  MatchItem,
  ExceptionSummary,
  ExceptionDetail,
  InvestigationNote,
  AiAnalysis,
  DashboardSummary,
  DashboardTrends,
  ReconciliationReport,
  ExceptionReport,
  AuditLog,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

class ApiService {
  private getHeaders(isFormData = false): HeadersInit {
    const headers: Record<string, string> = {};
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }
    const token = localStorage.getItem('lendguard_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const isFormData = options.body instanceof FormData;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(isFormData),
        ...options.headers,
      },
    });

    if (response.status === 204) {
      return {} as T;
    }

    if (!response.ok) {
      let errorMessage = 'An unexpected error occurred.';
      try {
        const errorData = await response.json();
        if (errorData?.error?.message) {
          errorMessage = errorData.error.message;
        } else if (errorData?.Error?.Message) {
          errorMessage = errorData.Error.Message;
        } else if (errorData?.message) {
          errorMessage = errorData.message;
        } else if (errorData?.Message) {
          errorMessage = errorData.Message;
        }
      } catch {
        errorMessage = `HTTP error ${response.status}: ${response.statusText}`;
      }

      if (response.status === 401 && !endpoint.includes('/auth/login')) {
        localStorage.removeItem('lendguard_token');
        localStorage.removeItem('lendguard_user');
        window.location.href = '/login?expired=true';
      }

      throw new Error(errorMessage);
    }

    return response.json();
  }

  // Auth
  async login(email: string, password: string): Promise<LoginResponse> {
    return this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async getMe(): Promise<UserProfile> {
    return this.request<UserProfile>('/auth/me');
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });
  }

  // Users
  async getUsers(params: { page?: number; pageSize?: number; search?: string; role?: string; status?: boolean } = {}): Promise<PaginatedResponse<UserSummary>> {
    const searchParams = new URLSearchParams({
      page: (params.page || 1).toString(),
      pageSize: (params.pageSize || 20).toString(),
    });
    if (params.search) searchParams.append('search', params.search);
    if (params.role) searchParams.append('role', params.role);
    if (params.status !== undefined) searchParams.append('status', params.status.toString());
    return this.request<PaginatedResponse<UserSummary>>(`/users?${searchParams}`);
  }

  async getUserById(id: string): Promise<UserDetail> {
    return this.request<UserDetail>(`/users/${id}`);
  }

  async createUser(data: { fullName: string; email: string; password?: string; temporaryPassword?: string; role: string }): Promise<UserDetail> {
    const payload = {
      fullName: data.fullName,
      email: data.email,
      temporaryPassword: data.temporaryPassword || data.password || 'Temp123!',
      role: data.role,
    };
    return this.request<UserDetail>('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateUser(id: string, data: { fullName: string; email: string; role: string }): Promise<UserDetail> {
    return this.request<UserDetail>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updateUserStatus(id: string, isActive: boolean): Promise<UserDetail> {
    return this.request<UserDetail>(`/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
  }

  async activateUser(id: string): Promise<UserDetail> {
    return this.updateUserStatus(id, true);
  }

  async deactivateUser(id: string): Promise<UserDetail> {
    return this.updateUserStatus(id, false);
  }

  // Imports
  async uploadImport(file: File, sourceType: 'INTERNAL' | 'EXTERNAL'): Promise<{ id: string; importId: string; status: string; message: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sourceType', sourceType);
    const res = await this.request<{ importId?: string; id?: string; status: string; message: string }>('/imports', {
      method: 'POST',
      body: formData,
    });
    const id = res.importId || res.id || '';
    return { ...res, id, importId: id };
  }

  async getImportBatches(params: { page?: number; pageSize?: number; sourceType?: string; status?: string } = {}): Promise<PaginatedResponse<ImportBatchSummary>> {
    const searchParams = new URLSearchParams({
      page: (params.page || 1).toString(),
      pageSize: (params.pageSize || 20).toString(),
    });
    if (params.sourceType) searchParams.append('sourceType', params.sourceType);
    if (params.status) searchParams.append('status', params.status);
    return this.request<PaginatedResponse<ImportBatchSummary>>(`/imports?${searchParams}`);
  }

  async getImportBatch(id: string): Promise<ImportBatchDetail> {
    return this.request<ImportBatchDetail>(`/imports/${id}`);
  }

  async getImportValidation(id: string, page = 1, pageSize = 20): Promise<ValidationResult> {
    const params = new URLSearchParams({ page: page.toString(), pageSize: pageSize.toString() });
    return this.request<ValidationResult>(`/imports/${id}/validation?${params}`);
  }

  async confirmImport(id: string): Promise<{ importId: string; status: string; importedRows: number; rejectedRows: number; duplicateRows: number; message: string }> {
    return this.request<{ importId: string; status: string; importedRows: number; rejectedRows: number; duplicateRows: number; message: string }>(`/imports/${id}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ confirmValidRows: true }),
    });
  }

  // Transactions
  async getTransactions(params: { page?: number; pageSize?: number; search?: string; sourceType?: 'INTERNAL' | 'EXTERNAL'; status?: string; from?: string; to?: string } = {}): Promise<PaginatedResponse<TransactionSummary>> {
    const searchParams = new URLSearchParams({
      page: (params.page || 1).toString(),
      pageSize: (params.pageSize || 20).toString(),
    });
    if (params.search) searchParams.append('search', params.search);
    if (params.sourceType) searchParams.append('sourceType', params.sourceType);
    if (params.status) searchParams.append('status', params.status);
    if (params.from) searchParams.append('from', params.from);
    if (params.to) searchParams.append('to', params.to);
    return this.request<PaginatedResponse<TransactionSummary>>(`/transactions?${searchParams}`);
  }

  async getTransaction(id: string): Promise<TransactionDetail> {
    return this.request<TransactionDetail>(`/transactions/${id}`);
  }

  // Reconciliation
  async createReconciliationRun(params: { internalBatchId: string; externalBatchId: string }): Promise<{ id: string; runId: string; status: string; message: string }> {
    const res = await this.request<{ runId?: string; id?: string; status: string; message: string }>('/reconciliation-runs', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    const id = res.runId || res.id || '';
    return { ...res, id, runId: id };
  }

  async getReconciliationRuns(params: { page?: number; pageSize?: number; status?: string } = {}): Promise<PaginatedResponse<ReconciliationRunSummary>> {
    const searchParams = new URLSearchParams({
      page: (params.page || 1).toString(),
      pageSize: (params.pageSize || 20).toString(),
    });
    if (params.status) searchParams.append('status', params.status);
    return this.request<PaginatedResponse<ReconciliationRunSummary>>(`/reconciliation-runs?${searchParams}`);
  }

  async getReconciliationRun(id: string): Promise<ReconciliationRunDetail> {
    return this.request<ReconciliationRunDetail>(`/reconciliation-runs/${id}`);
  }

  async getReconciliationMatches(runId: string, page = 1, pageSize = 50): Promise<PaginatedResponse<MatchItem>> {
    const params = new URLSearchParams({ page: page.toString(), pageSize: pageSize.toString() });
    return this.request<PaginatedResponse<MatchItem>>(`/reconciliation-runs/${runId}/matches?${params}`);
  }

  // Exceptions
  async getExceptions(params: {
    page?: number;
    pageSize?: number;
    reconciliationRunId?: string;
    exceptionType?: string;
    type?: string;
    severity?: string;
    status?: string;
    assignedToId?: string;
    assignedTo?: string;
    unassignedOnly?: boolean;
  } = {}): Promise<PaginatedResponse<ExceptionSummary>> {
    const searchParams = new URLSearchParams({
      page: (params.page || 1).toString(),
      pageSize: (params.pageSize || 20).toString(),
    });
    if (params.reconciliationRunId) searchParams.append('reconciliationRunId', params.reconciliationRunId);
    if (params.exceptionType || params.type) searchParams.append('type', params.exceptionType || params.type || '');
    if (params.severity) searchParams.append('severity', params.severity);
    if (params.status) searchParams.append('status', params.status);
    if (params.unassignedOnly) searchParams.append('unassignedOnly', 'true');
    if (params.assignedToId || params.assignedTo) searchParams.append('assignedTo', params.assignedToId || params.assignedTo || '');
    return this.request<PaginatedResponse<ExceptionSummary>>(`/exceptions?${searchParams}`);
  }

  async getException(id: string): Promise<ExceptionDetail> {
    return this.request<ExceptionDetail>(`/exceptions/${id}`);
  }

  async assignException(id: string, assignedTo: string): Promise<ExceptionDetail> {
    return this.request<ExceptionDetail>(`/exceptions/${id}/assignment`, {
      method: 'PATCH',
      body: JSON.stringify({ assignedTo }),
    });
  }

  async batchAssignExceptions(exceptionIds: string[], assignedTo: string): Promise<{ assignedCount: number; updatedIds: string[] }> {
    return this.request<{ assignedCount: number; updatedIds: string[] }>('/exceptions/batch-assignment', {
      method: 'POST',
      body: JSON.stringify({ exceptionIds, assignedTo }),
    });
  }

  async getExceptionNotes(id: string): Promise<InvestigationNote[]> {
    return this.request<InvestigationNote[]>(`/exceptions/${id}/notes`);
  }

  async addExceptionNote(id: string, note: string): Promise<InvestigationNote> {
    return this.request<InvestigationNote>(`/exceptions/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
  }

  async analyzeException(id: string, analysisType: 'ALL' | 'EXPLANATION' | 'ANOMALY' = 'ALL'): Promise<{ explanation?: AiAnalysis; anomaly?: AiAnalysis; primary?: AiAnalysis }> {
    await this.request<{ analysisId: string; status: string }>(`/exceptions/${id}/analysis`, {
      method: 'POST',
      body: JSON.stringify({ analysisType }),
    });
    const { explanation, anomaly, all } = await this.getExceptionAiAnalyses(id);
    return {
      explanation,
      anomaly,
      primary: explanation || anomaly || (all.length > 0 ? all[0] : undefined),
    };
  }

  async getExceptionAiAnalyses(id: string): Promise<{ explanation?: AiAnalysis; anomaly?: AiAnalysis; all: AiAnalysis[] }> {
    const list = await this.request<AiAnalysis[]>(`/exceptions/${id}/analysis?latest=true`);
    const anomaly = list.find((a) => a.analysisType === 'ANOMALY');
    const explanation = list.find((a) => a.analysisType === 'EXPLANATION');
    return { anomaly, explanation, all: list };
  }

  async getExceptionAiAnalysis(id: string): Promise<AiAnalysis | null> {
    const { explanation, anomaly, all } = await this.getExceptionAiAnalyses(id);
    return explanation || anomaly || (all.length > 0 ? all[0] : null);
  }

  async resolveException(id: string, data: { resolutionCategory: string; resolutionExplanation: string }): Promise<ExceptionDetail> {
    return this.request<ExceptionDetail>(`/exceptions/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({
        resolutionCategory: data.resolutionCategory,
        explanation: data.resolutionExplanation,
      }),
    });
  }

  // Dashboard
  async getDashboardSummary(dateFrom?: string, dateTo?: string): Promise<DashboardSummary> {
    const params = new URLSearchParams();
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);
    return this.request<DashboardSummary>(`/dashboard/summary?${params}`);
  }

  async getDashboardTrends(interval = 'daily', dateFrom?: string, dateTo?: string): Promise<DashboardTrends> {
    const params = new URLSearchParams({ interval });
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);
    return this.request<DashboardTrends>(`/dashboard/trends?${params}`);
  }

  // Reports
  async getReconciliationReport(params: { startDate?: string; endDate?: string; status?: string } = {}): Promise<ReconciliationReport> {
    const searchParams = new URLSearchParams();
    if (params.startDate) searchParams.append('dateFrom', params.startDate);
    if (params.endDate) searchParams.append('dateTo', params.endDate);
    if (params.status) searchParams.append('status', params.status);
    return this.request<ReconciliationReport>(`/reports/reconciliation?${searchParams}`);
  }

  async getExceptionReport(params: { startDate?: string; endDate?: string; status?: string } = {}): Promise<ExceptionReport> {
    const searchParams = new URLSearchParams();
    if (params.startDate) searchParams.append('dateFrom', params.startDate);
    if (params.endDate) searchParams.append('dateTo', params.endDate);
    if (params.status) searchParams.append('status', params.status);
    return this.request<ExceptionReport>(`/reports/exceptions?${searchParams}`);
  }

  async exportReconciliationReportCsv(params: { startDate?: string; endDate?: string; status?: string } = {}): Promise<Blob> {
    const searchParams = new URLSearchParams();
    if (params.startDate) searchParams.append('dateFrom', params.startDate);
    if (params.endDate) searchParams.append('dateTo', params.endDate);
    if (params.status) searchParams.append('status', params.status);
    const token = localStorage.getItem('lendguard_token');
    const response = await fetch(`${API_BASE_URL}/reports/reconciliation/export?${searchParams}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.blob();
  }

  async exportExceptionReportCsv(params: { startDate?: string; endDate?: string; status?: string } = {}): Promise<Blob> {
    const searchParams = new URLSearchParams();
    if (params.startDate) searchParams.append('dateFrom', params.startDate);
    if (params.endDate) searchParams.append('dateTo', params.endDate);
    if (params.status) searchParams.append('status', params.status);
    const token = localStorage.getItem('lendguard_token');
    const response = await fetch(`${API_BASE_URL}/reports/exceptions/export?${searchParams}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.blob();
  }

  // Audit Logs
  async getAuditLogs(params: { page?: number; pageSize?: number; actor?: string; action?: string; entityType?: string } = {}): Promise<PaginatedResponse<AuditLog>> {
    const searchParams = new URLSearchParams({
      page: (params.page || 1).toString(),
      pageSize: (params.pageSize || 20).toString(),
    });
    if (params.actor) searchParams.append('actor', params.actor);
    if (params.action) searchParams.append('action', params.action);
    if (params.entityType) searchParams.append('entityType', params.entityType);
    return this.request<PaginatedResponse<AuditLog>>(`/audit-logs?${searchParams}`);
  }
}

export const api = new ApiService();
