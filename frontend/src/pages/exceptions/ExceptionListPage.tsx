import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { ExceptionSummary } from '../../types';
import { StatusBadge, SeverityBadge } from '../../components/Badge';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { useAuth } from '../../context/AuthContext';
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
  ShieldAlert,
} from 'lucide-react';

type WorkloadTab = 'ALL' | 'MINE' | 'UNASSIGNED' | 'RESOLVED';

export const ExceptionListPage: React.FC = () => {
  const [exceptions, setExceptions] = useState<ExceptionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Workload Tab
  const [activeTab, setActiveTab] = useState<WorkloadTab>('ALL');

  // Granular Filters
  const [status, setStatus] = useState<string>('ACTIVE');
  const [severity, setSeverity] = useState<string>('');
  const [exceptionType, setExceptionType] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalCount, setTotalCount] = useState(0);

  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleTabChange = (tab: WorkloadTab) => {
    setActiveTab(tab);
    setPage(1);
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
  }, [activeTab, status, severity, exceptionType, page]);

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Workload Tab Navigation */}
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
              transition: 'all 0.15s ease'
            }}
          >
            <ListFilter size={14} />
            <span>All Workload</span>
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
              transition: 'all 0.15s ease'
            }}
          >
            <UserCheck size={14} />
            <span>Assigned to Me</span>
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
              transition: 'all 0.15s ease'
            }}
          >
            <Inbox size={14} />
            <span>Unassigned Queue</span>
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
              transition: 'all 0.15s ease'
            }}
          >
            <CheckCircle2 size={14} />
            <span>Resolved History</span>
          </button>
        </div>

        <span style={{ fontSize: '13px', color: '#64748B' }}>
          <strong>{totalCount}</strong> discrepancies found
        </span>
      </div>

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
          style={{ fontSize: '13px', width: '150px' }}
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
          style={{ fontSize: '13px', width: '190px' }}
        >
          <option value="">All Discrepancy Types</option>
          <option value="AMOUNT_MISMATCH">Amount Mismatch</option>
          <option value="MISSING_SETTLEMENT">Missing Settlement</option>
          <option value="UNMATCHED_EXTERNAL">Unmatched External</option>
          <option value="DUPLICATE">Duplicate</option>
          <option value="PARTIAL_SETTLEMENT">Partial Settlement</option>
          <option value="AMBIGUOUS_MATCH">Ambiguous Match</option>
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
                ? 'You currently have zero discrepancies assigned to your queue. You can claim unassigned items from the Unassigned Queue tab.'
                : 'There are currently no reconciliation discrepancies matching the selected filter criteria.'
            }
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
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

                  return (
                    <tr
                      key={ex.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/exceptions/${ex.id}`)}
                    >
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
                            <span style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: '4px',
                              backgroundColor: '#FEE2E2',
                              color: '#DC2626',
                              border: '1px solid #FECACA',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px'
                            }} title="Flagged as Outlier by Scikit-Learn IsolationForest Model">
                              <span>⚠️</span>
                              <span>Outlier Anomaly</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={ex.status} size="sm" />
                      </td>
                      <td>
                        {ex.assignedTo ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 9px',
                            borderRadius: '6px',
                            backgroundColor: isAssignedToMe ? '#DCFCE7' : '#F1F5F9',
                            color: isAssignedToMe ? '#15803D' : '#334155',
                            fontWeight: isAssignedToMe ? 700 : 500,
                            fontSize: '12px',
                            border: isAssignedToMe ? '1px solid #BBF7D0' : '1px solid #E2E8F0'
                          }}>
                            <UserCheck size={13} style={{ color: isAssignedToMe ? '#16A34A' : '#64748B' }} />
                            <span>{ex.assignedTo.fullName}{isAssignedToMe ? ' (You)' : ''}</span>
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            backgroundColor: '#FEF3C7',
                            color: '#B45309',
                            fontWeight: 500,
                            fontSize: '12px'
                          }}>
                            <AlertTriangle size={12} />
                            <span>Unassigned</span>
                          </span>
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
