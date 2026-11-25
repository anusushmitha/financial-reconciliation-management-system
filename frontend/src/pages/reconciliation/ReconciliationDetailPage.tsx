import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { ReconciliationRunDetail, MatchItem, ExceptionSummary } from '../../types';
import { StatusBadge, SeverityBadge } from '../../components/Badge';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Clock,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { SpotlightCard } from '../../components/reactbits/SpotlightCard';
import { AnimatedCounter } from '../../components/reactbits/AnimatedCounter';
import { DecryptedText } from '../../components/reactbits/DecryptedText';
import { CircularGauge } from '../../components/reactbits/CircularGauge';

export const ReconciliationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [run, setRun] = useState<ReconciliationRunDetail | null>(null);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [exceptions, setExceptions] = useState<ExceptionSummary[]>([]);
  const [activeTab, setActiveTab] = useState<'matches' | 'exceptions'>('matches');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  const loadRunDetails = async () => {
    if (!id) return;
    try {
      setError(null);
      const [runData, matchData, exData] = await Promise.all([
        api.getReconciliationRun(id),
        api.getReconciliationMatches(id),
        api.getExceptions({ reconciliationRunId: id, pageSize: 50 }),
      ]);
      setRun(runData);
      setMatches(matchData.items);
      setExceptions(exData.items);
    } catch (err: any) {
      setError(err?.message || 'Failed to load reconciliation run details.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadRunDetails();
  }, [id]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadRunDetails();
  };

  if (loading && !run) {
    return (
      <div className="card" style={{ padding: '28px' }}>
        <LoadingSkeleton rows={7} height="40px" />
      </div>
    );
  }

  if (error && !run) {
    return (
      <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
        <div style={{ color: '#DC2626', marginBottom: '16px' }}>{error}</div>
        <button className="btn btn-secondary" onClick={() => navigate('/reconciliation-runs')}>
          <ArrowLeft size={16} />
          <span>Back to Reconciliation Runs</span>
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top action row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          className="btn btn-secondary"
          onClick={() => navigate('/reconciliation-runs')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
        >
          <ArrowLeft size={16} />
          <span>Back to Reconciliation Runs</span>
        </button>

        <button
          className="btn btn-secondary"
          onClick={handleRefresh}
          disabled={refreshing}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          <span>Refresh Details</span>
        </button>
      </div>

      {/* Main Run Summary Card with React Bits Spotlight & Astryx Tokens */}
      {run && (
        <SpotlightCard spotlightColor="rgba(22, 163, 74, 0.12)" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '18px', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Run #</span>
                  <DecryptedText text={run.id.slice(0, 8)} speed={30} />
                </h2>
                <StatusBadge status={run.status} />
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                Rule Version: <span style={{ fontWeight: 600, color: '#334155' }}>{run.ruleVersion}</span> • Started: {new Date(run.startedAt).toLocaleString()}
                {run.completedAt && ` • Completed: ${new Date(run.completedAt).toLocaleString()}`}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <CircularGauge
                value={run.totalInternal > 0 ? (run.matchedCount / run.totalInternal) * 100 : 0}
                size={95}
                strokeWidth={7}
                label="Match Rate"
                color="#16A34A"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div style={{ padding: '14px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '12px', color: '#64748B', display: 'block', marginBottom: '4px' }}>Internal Batch</span>
              <span style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'monospace', color: '#1E293B' }}>
                <DecryptedText text={run.internalBatchReference || run.internalBatchId.slice(0, 8)} speed={25} />
              </span>
              <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>{run.totalInternal} rows evaluated</div>
            </div>

            <div style={{ padding: '14px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '12px', color: '#64748B', display: 'block', marginBottom: '4px' }}>External Batch</span>
              <span style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'monospace', color: '#1E293B' }}>
                <DecryptedText text={run.externalBatchReference || run.externalBatchId.slice(0, 8)} speed={25} />
              </span>
              <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>{run.totalExternal} rows evaluated</div>
            </div>

            <div style={{ padding: '14px', backgroundColor: '#F0FDF4', borderRadius: '8px', border: '1px solid #BBF7D0' }}>
              <span style={{ fontSize: '12px', color: '#166534', display: 'block', marginBottom: '4px' }}>Clean Matches</span>
              <span style={{ fontSize: '24px', fontWeight: 700, color: '#16A34A', display: 'block' }}>
                <AnimatedCounter end={run.matchedCount} duration={1000} />
              </span>
            </div>

            <div style={{ padding: '14px', backgroundColor: '#FEF2F2', borderRadius: '8px', border: '1px solid #FECACA' }}>
              <span style={{ fontSize: '12px', color: '#991B1B', display: 'block', marginBottom: '4px' }}>Discrepancies Flagged</span>
              <span style={{ fontSize: '24px', fontWeight: 700, color: '#DC2626', display: 'block' }}>
                <AnimatedCounter end={run.exceptionCount} duration={1000} />
              </span>
            </div>
          </div>
        </SpotlightCard>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)' }}>
        <button
          className="btn"
          onClick={() => setActiveTab('matches')}
          style={{
            borderBottom: activeTab === 'matches' ? '2px solid var(--primary)' : 'none',
            borderRadius: '0',
            color: activeTab === 'matches' ? 'var(--primary)' : '#64748B',
            fontWeight: activeTab === 'matches' ? 600 : 500,
            backgroundColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={18} color={activeTab === 'matches' ? 'var(--primary)' : '#64748B'} />
          <span>Matched Records ({matches.length})</span>
        </button>

        <button
          className="btn"
          onClick={() => setActiveTab('exceptions')}
          style={{
            borderBottom: activeTab === 'exceptions' ? '2px solid #DC2626' : 'none',
            borderRadius: '0',
            color: activeTab === 'exceptions' ? '#DC2626' : '#64748B',
            fontWeight: activeTab === 'exceptions' ? 600 : 500,
            backgroundColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertTriangle size={18} color={activeTab === 'exceptions' ? '#DC2626' : '#64748B'} />
          <span>Discrepancy Exceptions ({exceptions.length})</span>
        </button>
      </div>

      {/* Tab 1: Matches Table */}
      {activeTab === 'matches' && (
        <div className="card">
          {matches.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No Matches Recorded"
              description="This reconciliation run did not yield any matches with zero discrepancy."
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Match ID</th>
                    <th>Match Type</th>
                    <th>Confidence</th>
                    <th>Associated Ledger References</th>
                    <th>Total Applied</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m) => (
                    <tr key={m.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary)' }}>
                        {m.id.slice(0, 8)}...
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>{m.matchType}</span>
                      </td>
                      <td>
                        <span style={{ backgroundColor: '#DCFCE7', color: '#166534', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                          {m.confidence ? `${(m.confidence * 100).toFixed(0)}%` : '100%'}
                        </span>
                      </td>
                      <td style={{ fontSize: '13px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {m.members.map((mem, idx) => (
                            <span key={idx} style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                              <strong style={{ color: '#475569' }}>[{mem.side}]</strong> {mem.transactionReference || mem.transactionId.slice(0, 8)}: ${Number(mem.amountApplied).toFixed(2)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        ${m.members.reduce((sum, mem) => sum + Number(mem.amountApplied), 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Exceptions Table */}
      {activeTab === 'exceptions' && (
        <div className="card">
          {exceptions.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Zero Discrepancies"
              description="No exceptions were flagged during this reconciliation run."
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
                    <th>Assigned To</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {exceptions.map((ex) => (
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
                        {ex.discrepancyAmount !== undefined && ex.discrepancyAmount !== null
                          ? `${ex.currency} ${Number(ex.discrepancyAmount).toFixed(2)}`
                          : 'N/A'}
                      </td>
                      <td>
                        <StatusBadge status={ex.status} size="sm" />
                      </td>
                      <td style={{ fontSize: '13px', color: '#64748B' }}>
                        {ex.assignedTo ? ex.assignedTo.fullName : 'Unassigned'}
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
