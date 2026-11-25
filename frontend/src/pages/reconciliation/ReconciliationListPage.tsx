import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { ReconciliationRunSummary, ImportBatchSummary } from '../../types';
import { StatusBadge } from '../../components/Badge';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import {
  Layers,
  Play,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Eye,
  Sliders,
} from 'lucide-react';
import { SpotlightCard } from '../../components/reactbits/SpotlightCard';
import { DecryptedText } from '../../components/reactbits/DecryptedText';
import { AnimatedCounter } from '../../components/reactbits/AnimatedCounter';
import { ShinyText } from '../../components/reactbits/ShinyText';

export const ReconciliationListPage: React.FC = () => {
  const [runs, setRuns] = useState<ReconciliationRunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Run Modal State
  const [showModal, setShowModal] = useState(false);
  const [internalBatches, setInternalBatches] = useState<ImportBatchSummary[]>([]);
  const [externalBatches, setExternalBatches] = useState<ImportBatchSummary[]>([]);
  const [selectedInternal, setSelectedInternal] = useState<string>('');
  const [selectedExternal, setSelectedExternal] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const navigate = useNavigate();

  const loadRuns = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getReconciliationRuns({ page: 1, pageSize: 20 });
      setRuns(res.items);
    } catch (err: any) {
      setError(err?.message || 'Failed to load reconciliation runs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRuns();
  }, []);

  const openStartModal = async () => {
    try {
      setModalError(null);
      setShowModal(true);
      const [intRes, extRes] = await Promise.all([
        api.getImportBatches({ sourceType: 'INTERNAL', status: 'CONFIRMED', pageSize: 50 }),
        api.getImportBatches({ sourceType: 'EXTERNAL', status: 'CONFIRMED', pageSize: 50 }),
      ]);
      setInternalBatches(intRes.items);
      setExternalBatches(extRes.items);
      if (intRes.items.length > 0) setSelectedInternal(intRes.items[0].id);
      if (extRes.items.length > 0) setSelectedExternal(extRes.items[0].id);
    } catch (err: any) {
      setModalError('Failed to retrieve confirmed batches for reconciliation.');
    }
  };

  const handleStartRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInternal || !selectedExternal) {
      setModalError('Both Internal and External confirmed batches are required.');
      return;
    }

    try {
      setSubmitting(true);
      setModalError(null);
      const run = await api.createReconciliationRun({
        internalBatchId: selectedInternal,
        externalBatchId: selectedExternal,
      });
      setShowModal(false);
      navigate(`/reconciliation-runs/${run.id}`);
    } catch (err: any) {
      setModalError(err?.message || 'Failed to initiate reconciliation run.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Action Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Deterministic two-sided ledger matching with financial audit rules
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={loadRuns} style={{ fontSize: '13px' }}>
            <RefreshCw size={14} />
          </button>
          <button
            className="btn btn-primary"
            onClick={openStartModal}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}
          >
            <Play size={16} />
            <span>New Reconciliation Run</span>
          </button>
        </div>
      </div>

      {error && (
        <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '12px 16px', borderRadius: '8px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* Runs Table with React Bits Spotlight */}
      <SpotlightCard spotlightColor="rgba(37, 99, 235, 0.08)">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
            Reconciliation Execution History
          </h3>
          <ShinyText text="Deterministic Rules v1.0" speed={3.5} />
        </div>

        {loading ? (
          <div style={{ padding: '20px' }}>
            <LoadingSkeleton rows={6} height="42px" />
          </div>
        ) : runs.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No Reconciliation Runs Found"
            description="Initiate your first reconciliation run by pairing an internal and external batch."
            actionText="Start Reconciliation"
            onAction={openStartModal}
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Run ID</th>
                  <th>Status</th>
                  <th>Matched Count</th>
                  <th>Exception Count</th>
                  <th>Started At</th>
                  <th>Completed At</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr
                    key={r.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/reconciliation-runs/${r.id}`)}
                  >
                    <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary)' }}>
                      <DecryptedText text={r.id.slice(0, 8)} speed={25} />
                    </td>
                    <td>
                      <StatusBadge status={r.status} size="sm" />
                    </td>
                    <td style={{ color: '#16A34A', fontWeight: 600 }}>
                      <AnimatedCounter value={r.matchedCount} />
                    </td>
                    <td style={{ color: r.exceptionCount > 0 ? '#DC2626' : '#64748B', fontWeight: 600 }}>
                      <AnimatedCounter value={r.exceptionCount} />
                    </td>
                    <td style={{ fontSize: '13px', color: '#64748B' }}>
                      {new Date(r.startedAt).toLocaleString()}
                    </td>
                    <td style={{ fontSize: '13px', color: '#64748B' }}>
                      {r.completedAt ? new Date(r.completedAt).toLocaleString() : 'In Progress'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '12px', padding: '4px 10px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/reconciliation-runs/${r.id}`);
                        }}
                      >
                        Inspect Run
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SpotlightCard>

      {/* Start Reconciliation Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Execute Reconciliation Run"
        description="Select confirmed ledger batches to execute deterministic matching rules RC-01 through RC-08."
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={submitting}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleStartRun}
              disabled={submitting || !selectedInternal || !selectedExternal}
            >
              {submitting ? 'Initiating Matching...' : 'Start Reconciliation'}
            </button>
          </>
        }
      >
        {modalError && (
          <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
            {modalError}
          </div>
        )}

        <form onSubmit={handleStartRun} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '6px' }}>
              Internal Lending Batch (Confirmed)
            </label>
            <select
              className="form-control"
              value={selectedInternal}
              onChange={(e) => setSelectedInternal(e.target.value)}
              required
            >
              {internalBatches.length === 0 ? (
                <option value="">No confirmed internal batches available</option>
              ) : (
                internalBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batchReference} — {b.validRows} rows ({b.fileName})
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '6px' }}>
              External Settlement Batch (Confirmed)
            </label>
            <select
              className="form-control"
              value={selectedExternal}
              onChange={(e) => setSelectedExternal(e.target.value)}
              required
            >
              {externalBatches.length === 0 ? (
                <option value="">No confirmed external batches available</option>
              ) : (
                externalBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batchReference} — {b.validRows} rows ({b.fileName})
                  </option>
                ))
              )}
            </select>
          </div>

          <div style={{ padding: '14px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>Reconciliation Engine Rule Set:</span>
              <span style={{ fontWeight: 600 }}>RC-01 - RC-08 (v2.0 Deterministic)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>Date Tolerance Window:</span>
              <span style={{ fontWeight: 600 }}>±2 Calendar Days</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>Amount Precision:</span>
              <span style={{ fontWeight: 600 }}>Exact Decimal (0.00 Tolerance)</span>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
