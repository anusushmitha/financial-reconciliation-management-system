import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { ExceptionSummary, UserSummary } from '../../types';
import { StatusBadge, SeverityBadge } from '../../components/Badge';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  AlertTriangle,
  Filter,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserPlus,
  Inbox,
  ListFilter,
  Check,
  X,
  Users,
} from 'lucide-react';

type WorkloadTab = 'ALL' | 'MINE' | 'UNASSIGNED' | 'RESOLVED';

export const ExceptionListPage: React.FC = () => {
  const { addToast } = useToast();
  const [exceptions, setExceptions] = useState<ExceptionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Active Workload Tab
  const [activeTab, setActiveTab] = useState<WorkloadTab>('ALL');

  // Workload tab live counts
  const [counts, setCounts] = useState({ all: 0, mine: 0, unassigned: 0, resolved: 0 });

  // Granular Filters
  const [status, setStatus] = useState<string>('ACTIVE');
  const [severity, setSeverity] = useState<string>('');
  const [exceptionType, setExceptionType] = useState<string>('');
  const [selectedAssigneeFilter, setSelectedAssigneeFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalCount, setTotalCount] = useState(0);

  // Analysts list for assignment
  const [analysts, setAnalysts] = useState<UserSummary[]>([]);

  // Selection & Bulk Actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAssigneeId, setBulkAssigneeId] = useState<string>('');
  const [bulkAssigning, setBulkAssigning] = useState(false);

  // Inline Quick-Assign row tracking
  const [inlineAssigningId, setInlineAssigningId] = useState<string | null>(null);

  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  // Load analysts list for assignment dropdowns
  useEffect(() => {
    const fetchAnalysts = async () => {
      try {
        const res = await api.getUsers({ pageSize: 50 });
        setAnalysts(res.items.filter((u) => u.isActive && (u.role === 'ANALYST' || u.role === 'ADMIN')));
      } catch (err) {
        console.error('Failed to load analysts for assignment', err);
      }
    };
    fetchAnalysts();
  }, []);

  const loadCounts = async () => {
    try {
      const [allRes, unassignedRes, resolvedRes, mineRes] = await Promise.all([
        api.getExceptions({ status: 'ACTIVE', pageSize: 1 }),
        api.getExceptions({ status: 'ACTIVE', unassignedOnly: true, pageSize: 1 }),
        api.getExceptions({ status: 'RESOLVED', pageSize: 1 }),
        user ? api.getExceptions({ status: 'ACTIVE', assignedToId: user.id, pageSize: 1 }) : Promise.resolve({ totalCount: 0 }),
      ]);
      setCounts({
        all: allRes.totalCount,
        unassigned: unassignedRes.totalCount,
        resolved: resolvedRes.totalCount,
        mine: mineRes.totalCount,
      });
    } catch (err) {
      console.warn('Could not load tab metrics', err);
    }
  };

  const handleTabChange = (tab: WorkloadTab) => {
    setActiveTab(tab);
    setPage(1);
    setSelectedIds(new Set());
    if (tab === 'RESOLVED') {
      setStatus('RESOLVED');
    } else {
      setStatus('ACTIVE');
    }
  };

  const loadExceptions = async () => {
    try {
      setLoading(true);
      setError(null);

      let assignedToId: string | undefined = undefined;
      let unassignedOnly: boolean | undefined = undefined;

      if (activeTab === 'MINE' && user) {
        assignedToId = user.id;
      } else if (activeTab === 'UNASSIGNED') {
        unassignedOnly = true;
      } else if (selectedAssigneeFilter === 'UNASSIGNED') {
        unassignedOnly = true;
      } else if (selectedAssigneeFilter) {
        assignedToId = selectedAssigneeFilter;
      }

      const res = await api.getExceptions({
        status: status || undefined,
        severity: severity || undefined,
        type: exceptionType || undefined,
        assignedToId,
        unassignedOnly,
        page,
        pageSize,
      });

      setExceptions(res.items);
      setTotalCount(res.totalCount);
    } catch (err: any) {
      setError(err?.message || 'Failed to load exceptions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExceptions();
    loadCounts();
  }, [activeTab, status, severity, exceptionType, selectedAssigneeFilter, page, user]);

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  // Multi-selection handlers
  const handleToggleSelectAll = () => {
    if (selectedIds.size === exceptions.length && exceptions.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(exceptions.map((e) => e.id)));
    }
  };

  const handleToggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Bulk assignment execution
  const handleExecuteBulkAssign = async () => {
    if (!bulkAssigneeId || selectedIds.size === 0) return;
    try {
      setBulkAssigning(true);
      setError(null);
      const res = await api.batchAssignExceptions(Array.from(selectedIds), bulkAssigneeId);
      const targetAnalyst = analysts.find((a) => a.id === bulkAssigneeId);
      setFeedbackMessage(`Successfully assigned ${res.assignedCount} exception(s) to ${targetAnalyst?.fullName || 'Analyst'}.`);
      setSelectedIds(new Set());
      setBulkAssigneeId('');
      await loadExceptions();
      await loadCounts();
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to execute bulk assignment.');
    } finally {
      setBulkAssigning(false);
    }
  };

  // Inline assignment execution
  const handleInlineAssign = async (exceptionId: string, targetUserId: string) => {
    try {
      setInlineAssigningId(exceptionId);
      await api.assignException(exceptionId, targetUserId);
      const targetAnalyst = analysts.find((a) => a.id === targetUserId);
      setFeedbackMessage(`Assigned exception to ${targetAnalyst?.fullName || 'Analyst'}.`);
      await loadExceptions();
      await loadCounts();
      setTimeout(() => setFeedbackMessage(null), 3500);
    } catch (err: any) {
      addToast(err?.message || 'Failed to update assignment.', 'error');
    } finally {
      setInlineAssigningId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Toast Feedback Notification */}
      {feedbackMessage && (
        <div
          style={{
            backgroundColor: '#DCFCE7',
            border: '1px solid #86EFAC',
            color: '#15803D',
            padding: '10px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} />
            <span>{feedbackMessage}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#15803D' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Workload Tab Navigation with Live Badges */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '6px', backgroundColor: '#F1F5F9', padding: '4px', borderRadius: '8px' }}>
          <button
            onClick={() => handleTabChange('ALL')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: activeTab === 'ALL' ? 600 : 500,
              backgroundColor: activeTab === 'ALL' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'ALL' ? 'var(--primary)' : '#64748B',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: activeTab === 'ALL' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <ListFilter size={14} />
            <span>All Workload</span>
            <span
              style={{
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '10px',
                backgroundColor: activeTab === 'ALL' ? '#E0E7FF' : '#E2E8F0',
                color: activeTab === 'ALL' ? 'var(--primary)' : '#475569',
                fontWeight: 600,
              }}
            >
              {counts.all}
            </span>
          </button>

          <button
            onClick={() => handleTabChange('MINE')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: activeTab === 'MINE' ? 600 : 500,
              backgroundColor: activeTab === 'MINE' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'MINE' ? '#15803D' : '#64748B',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: activeTab === 'MINE' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <UserCheck size={14} />
            <span>Assigned to Me</span>
            <span
              style={{
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '10px',
                backgroundColor: activeTab === 'MINE' ? '#DCFCE7' : '#E2E8F0',
                color: activeTab === 'MINE' ? '#15803D' : '#475569',
                fontWeight: 600,
              }}
            >
              {counts.mine}
            </span>
          </button>

          <button
            onClick={() => handleTabChange('UNASSIGNED')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: activeTab === 'UNASSIGNED' ? 600 : 500,
              backgroundColor: activeTab === 'UNASSIGNED' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'UNASSIGNED' ? '#B45309' : '#64748B',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: activeTab === 'UNASSIGNED' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Inbox size={14} />
            <span>Unassigned Queue</span>
            <span
              style={{
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '10px',
                backgroundColor: activeTab === 'UNASSIGNED' ? '#FEF3C7' : '#E2E8F0',
                color: activeTab === 'UNASSIGNED' ? '#B45309' : '#475569',
                fontWeight: 600,
              }}
            >
              {counts.unassigned}
            </span>
          </button>

          <button
            onClick={() => handleTabChange('RESOLVED')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: activeTab === 'RESOLVED' ? 600 : 500,
              backgroundColor: activeTab === 'RESOLVED' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'RESOLVED' ? '#0F766E' : '#64748B',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: activeTab === 'RESOLVED' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <CheckCircle2 size={14} />
            <span>Resolved History</span>
            <span
              style={{
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '10px',
                backgroundColor: activeTab === 'RESOLVED' ? '#CCFBF1' : '#E2E8F0',
                color: activeTab === 'RESOLVED' ? '#0F766E' : '#475569',
                fontWeight: 600,
              }}
            >
              {counts.resolved}
            </span>
          </button>
        </div>

        <span style={{ fontSize: '13px', color: '#64748B' }}>
          <strong>{totalCount}</strong> discrepancies found
        </span>
      </div>

      {/* Floating Multi-Row Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div
          style={{
            backgroundColor: '#1E293B',
            color: '#FFFFFF',
            padding: '12px 20px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ backgroundColor: 'var(--primary)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 700 }}>
              {selectedIds.size} Selected
            </span>
            <span style={{ fontSize: '13px', color: '#94A3B8' }}>Choose an analyst to batch assign:</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <select
              value={bulkAssigneeId}
              onChange={(e) => setBulkAssigneeId(e.target.value)}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                borderRadius: '6px',
                backgroundColor: '#334155',
                color: '#FFFFFF',
                border: '1px solid #475569',
              }}
            >
              <option value="">Select Assignee...</option>
              {analysts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.fullName} ({a.email})
                </option>
              ))}
            </select>

            <button
              onClick={handleExecuteBulkAssign}
              disabled={bulkAssigning || !bulkAssigneeId}
              className="btn btn-primary"
              style={{ fontSize: '12px', padding: '6px 14px' }}
            >
              {bulkAssigning ? 'Assigning...' : 'Assign Selected'}
            </button>

            <button
              onClick={() => setSelectedIds(new Set())}
              style={{
                background: 'transparent',
                border: '1px solid #475569',
                color: '#94A3B8',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="card" style={{ padding: '14px 18px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
          <Filter size={13} />
          <span>Filters:</span>
        </div>

        <select
          className="form-control"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          style={{ fontSize: '13px', width: '170px' }}
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active (Open & In Progress)</option>
          <option value="OPEN">Open Only</option>
          <option value="IN_PROGRESS">In Progress (Assigned)</option>
          <option value="RESOLVED">Resolved Only</option>
        </select>

        <select
          className="form-control"
          value={severity}
          onChange={(e) => {
            setSeverity(e.target.value);
            setPage(1);
          }}
          style={{ fontSize: '13px', width: '140px' }}
        >
          <option value="">All Severities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>

        <select
          className="form-control"
          value={exceptionType}
          onChange={(e) => {
            setExceptionType(e.target.value);
            setPage(1);
          }}
          style={{ fontSize: '13px', width: '180px' }}
        >
          <option value="">All Discrepancy Types</option>
          <option value="AMOUNT_MISMATCH">Amount Mismatch</option>
          <option value="MISSING_SETTLEMENT">Missing Settlement</option>
          <option value="UNMATCHED_EXTERNAL">Unmatched External</option>
          <option value="DUPLICATE">Duplicate</option>
          <option value="PARTIAL_SETTLEMENT">Partial Settlement</option>
          <option value="AMBIGUOUS_MATCH">Ambiguous Match</option>
        </select>

        {/* Assigned Analyst Filter */}
        <select
          className="form-control"
          value={selectedAssigneeFilter}
          onChange={(e) => {
            setSelectedAssigneeFilter(e.target.value);
            setPage(1);
          }}
          style={{ fontSize: '13px', width: '190px' }}
        >
          <option value="">All Assignees</option>
          <option value="UNASSIGNED">Unassigned Only</option>
          {analysts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.fullName} {user?.id === a.id ? '(You)' : ''}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '12px 16px', borderRadius: '8px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* Exception Table */}
      <div className="card">
        {loading ? (
          <div style={{ padding: '20px' }}>
            <LoadingSkeleton rows={8} height="44px" />
          </div>
        ) : exceptions.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title={activeTab === 'MINE' ? 'No Exceptions Assigned to You' : 'No Exceptions Found'}
            description={
              activeTab === 'MINE'
                ? 'You currently have zero discrepancies assigned to your queue. You can claim unassigned items from the Unassigned Queue tab or assign via admin.'
                : 'There are currently no reconciliation discrepancies matching the selected filter criteria.'
            }
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ width: '38px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.size === exceptions.length && exceptions.length > 0}
                      onChange={handleToggleSelectAll}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th>Exception ID</th>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Discrepancy Amount</th>
                  <th>Status</th>
                  <th>Assigned Analyst</th>
                  <th>Flagged Date</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {exceptions.map((ex) => {
                  const isAssignedToMe = user && ex.assignedTo && ex.assignedTo.id === user.id;
                  const isSelected = selectedIds.has(ex.id);

                  return (
                    <tr
                      key={ex.id}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: isSelected ? '#F0F9FF' : 'transparent',
                      }}
                      onClick={() => navigate(`/exceptions/${ex.id}`)}
                    >
                      <td
                        style={{ textAlign: 'center' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSelectRow(ex.id);
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary)' }}>
                        {ex.id.slice(0, 8)}...
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>{ex.exceptionType}</span>
                      </td>
                      <td>
                        <SeverityBadge severity={ex.severity} size="sm" />
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>
                            {ex.discrepancyAmount !== undefined && ex.discrepancyAmount !== null
                              ? `${ex.currency} ${Number(ex.discrepancyAmount).toFixed(2)}`
                              : 'N/A'}
                          </span>
                          {(Number(ex.discrepancyAmount) >= 5000 || ex.severity === 'CRITICAL') && (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '1px 5px',
                                borderRadius: '4px',
                                backgroundColor: '#FEE2E2',
                                color: '#DC2626',
                                border: '1px solid #FECACA',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                              }}
                              title="Flagged as Outlier by Scikit-Learn IsolationForest Model"
                            >
                              <span>⚠️</span>
                              <span>Outlier Anomaly</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={ex.status} size="sm" />
                      </td>
                      <td
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        {/* Interactive Assignee Badge with Inline Quick-Assign */}
                        {isAdmin ? (
                          <select
                            value={ex.assignedTo?.id || ''}
                            onChange={(e) => {
                              if (e.target.value) {
                                handleInlineAssign(ex.id, e.target.value);
                              }
                            }}
                            disabled={inlineAssigningId === ex.id}
                            style={{
                              fontSize: '12px',
                              fontWeight: 500,
                              padding: '3px 8px',
                              borderRadius: '6px',
                              border: ex.assignedTo ? (isAssignedToMe ? '1px solid #BBF7D0' : '1px solid #CBD5E1') : '1px dashed #F59E0B',
                              backgroundColor: ex.assignedTo ? (isAssignedToMe ? '#DCFCE7' : '#F8FAFC') : '#FEF3C7',
                              color: ex.assignedTo ? (isAssignedToMe ? '#15803D' : '#334155') : '#B45309',
                              cursor: 'pointer',
                            }}
                          >
                            <option value="" disabled>
                              + Assign Analyst
                            </option>
                            {analysts.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.fullName} {user?.id === a.id ? '(You)' : ''}
                              </option>
                            ))}
                          </select>
                        ) : ex.assignedTo ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '3px 9px',
                              borderRadius: '6px',
                              backgroundColor: isAssignedToMe ? '#DCFCE7' : '#F1F5F9',
                              color: isAssignedToMe ? '#15803D' : '#334155',
                              fontWeight: isAssignedToMe ? 700 : 500,
                              fontSize: '12px',
                              border: isAssignedToMe ? '1px solid #BBF7D0' : '1px solid #E2E8F0',
                            }}
                          >
                            <UserCheck size={13} style={{ color: isAssignedToMe ? '#16A34A' : '#64748B' }} />
                            <span>
                              {ex.assignedTo.fullName}
                              {isAssignedToMe ? ' (You)' : ''}
                            </span>
                          </span>
                        ) : (
                          <button
                            onClick={() => user && handleInlineAssign(ex.id, user.id)}
                            disabled={inlineAssigningId === ex.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 9px',
                              borderRadius: '6px',
                              backgroundColor: '#FEF3C7',
                              color: '#B45309',
                              fontWeight: 600,
                              fontSize: '11px',
                              border: '1px solid #FDE68A',
                              cursor: 'pointer',
                            }}
                            title="Click to claim this exception to your queue"
                          >
                            <UserPlus size={12} />
                            <span>Claim to Me</span>
                          </button>
                        )}
                      </td>
                      <td style={{ fontSize: '13px', color: '#64748B' }}>
                        {new Date(ex.createdAt).toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: '12px', padding: '4px 10px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/exceptions/${ex.id}`);
                          }}
                        >
                          Investigate
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalCount > 0 && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Page {page} of {totalPages}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{ padding: '4px 10px', fontSize: '12px' }}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                className="btn btn-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                style={{ padding: '4px 10px', fontSize: '12px' }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
