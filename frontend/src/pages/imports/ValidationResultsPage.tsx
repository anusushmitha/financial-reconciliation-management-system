import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { ValidationResult, ImportBatchSummary } from '../../types';
import { StatusBadge } from '../../components/Badge';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { Modal } from '../../components/Modal';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { SpotlightCard } from '../../components/reactbits/SpotlightCard';
import { AnimatedCounter } from '../../components/reactbits/AnimatedCounter';
import { DecryptedText } from '../../components/reactbits/DecryptedText';

export const ValidationResultsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [valData, setValData] = useState<ValidationResult | null>(null);
  const [batch, setBatch] = useState<ImportBatchSummary | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const navigate = useNavigate();

  const loadValidation = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const [resVal, resBatch] = await Promise.all([
        api.getImportValidation(id, page, 15),
        api.getImportBatch(id),
      ]);
      setValData(resVal);
      setBatch(resBatch);
    } catch (err: any) {
      setError(err?.message || 'Failed to load validation details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadValidation();
  }, [id, page]);

  const handleConfirmBatch = async () => {
    if (!id) return;
    try {
      setConfirming(true);
      setError(null);
      await api.confirmImport(id);
      setShowConfirmModal(false);
      setSuccessMsg('Batch successfully confirmed! Valid transactions committed to the operational ledger.');
      await loadValidation();
    } catch (err: any) {
      setError(err?.message || 'Failed to confirm import batch.');
    } finally {
      setConfirming(false);
    }
  };

  if (loading && !valData) {
    return (
      <div className="card" style={{ padding: '28px' }}>
        <LoadingSkeleton rows={7} height="40px" />
      </div>
    );
  }

  if (error && !valData) {
    return (
      <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
        <div style={{ color: '#DC2626', marginBottom: '16px' }}>{error}</div>
        <button className="btn btn-secondary" onClick={() => navigate('/imports')}>
          <ArrowLeft size={16} />
          <span>Back to Imports</span>
        </button>
      </div>
    );
  }

  const isConfirmed = batch?.status === 'CONFIRMED';
  const totalErrorPages = valData ? Math.ceil(valData.totalCount / valData.pageSize) || 1 : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Navigation & Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          className="btn btn-secondary"
          onClick={() => navigate('/imports')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
        >
          <ArrowLeft size={16} />
          <span>Back to Imports</span>
        </button>

        {!isConfirmed && valData && valData.validRows > 0 && (
          <button
            className="btn btn-primary"
            onClick={() => setShowConfirmModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <Check size={16} />
            <span>Confirm {valData.validRows} Valid Records</span>
          </button>
        )}
      </div>

      {successMsg && (
        <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} />
            <span>{successMsg}</span>
          </div>
          <button
            className="btn btn-secondary"
            style={{ fontSize: '12px', padding: '4px 10px', backgroundColor: '#FFFFFF' }}
            onClick={() => navigate('/reconciliation-runs')}
          >
            Run Reconciliation
          </button>
        </div>
      )}

      {/* Batch Overview Card with React Bits Spotlight */}
      {batch && valData && (
        <SpotlightCard spotlightColor="rgba(37, 99, 235, 0.10)" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: '18px', marginBottom: '20px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, fontFamily: 'monospace' }}>
                  <DecryptedText text={batch.batchReference} speed={30} />
                </h2>
                <StatusBadge status={batch.status} />
                <StatusBadge status={batch.sourceType} />
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                File: {batch.fileName} • Uploaded on {new Date(batch.createdAt).toLocaleString()}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Validation Pass Rate</span>
              <div style={{ fontSize: '20px', fontWeight: 700, color: valData.rejectedRows === 0 ? '#16A34A' : '#D97706' }}>
                {valData.totalRows > 0 ? `${((valData.validRows / valData.totalRows) * 100).toFixed(1)}%` : '0%'}
              </div>
            </div>
          </div>

          {/* Validation Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            <div style={{ padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '12px', color: '#64748B', display: 'block', marginBottom: '4px' }}>Total Rows Processed</span>
              <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)', display: 'block' }}>
                <AnimatedCounter end={valData.totalRows} />
              </span>
            </div>

            <div style={{ padding: '16px', backgroundColor: '#F0FDF4', borderRadius: '8px', border: '1px solid #BBF7D0' }}>
              <span style={{ fontSize: '12px', color: '#166534', display: 'block', marginBottom: '4px' }}>Valid Records</span>
              <span style={{ fontSize: '24px', fontWeight: 700, color: '#16A34A', display: 'block' }}>
                <AnimatedCounter end={valData.validRows} />
              </span>
            </div>

            <div style={{ padding: '16px', backgroundColor: '#FEF2F2', borderRadius: '8px', border: '1px solid #FECACA' }}>
              <span style={{ fontSize: '12px', color: '#991B1B', display: 'block', marginBottom: '4px' }}>Rejected Rows</span>
              <span style={{ fontSize: '24px', fontWeight: 700, color: '#DC2626', display: 'block' }}>
                <AnimatedCounter end={valData.rejectedRows} />
              </span>
            </div>

            <div style={{ padding: '16px', backgroundColor: '#FFFBEB', borderRadius: '8px', border: '1px solid #FDE68A' }}>
              <span style={{ fontSize: '12px', color: '#92400E', display: 'block', marginBottom: '4px' }}>Duplicate Rows</span>
              <span style={{ fontSize: '24px', fontWeight: 700, color: '#D97706', display: 'block' }}>
                <AnimatedCounter end={valData.duplicateRows} />
              </span>
            </div>
          </div>
        </SpotlightCard>
      )}

      {/* Row-Level Errors Table */}
      <div className="card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
            Row-Level Syntax & Reference Errors ({valData?.totalCount || 0})
          </h3>
        </div>

        {valData && valData.errors.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center', color: '#16A34A' }}>
            <CheckCircle2 size={32} style={{ margin: '0 auto 10px', display: 'block' }} />
            <h4 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 4px' }}>Zero Validation Errors</h4>
            <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
              All rows passed syntax, schema, currency, and uniqueness checks.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Row #</th>
                  <th>Field</th>
                  <th>Error Code</th>
                  <th>Error Message</th>
                  <th>Raw Content</th>
                </tr>
              </thead>
              <tbody>
                {valData?.errors.map((err, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>#{err.rowNumber}</td>
                    <td style={{ fontWeight: 500, fontSize: '13px' }}>{err.fieldName || 'RECORD'}</td>
                    <td>
                      <span style={{ backgroundColor: '#FEE2E2', color: '#991B1B', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                        {err.errorCode}
                      </span>
                    </td>
                    <td style={{ fontSize: '13px', color: '#DC2626' }}>{err.errorMessage}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '11px', color: '#64748B', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {err.rawRow || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {valData && valData.totalCount > valData.pageSize && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Page {page} of {totalErrorPages}
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
                disabled={page >= totalErrorPages}
                onClick={() => setPage((p) => p + 1)}
                style={{ padding: '4px 10px', fontSize: '12px' }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Confirm Import Batch"
        description="Verify and commit valid transaction rows to the active ledger."
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowConfirmModal(false)} disabled={confirming}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleConfirmBatch} disabled={confirming}>
              {confirming ? 'Committing Records...' : 'Confirm & Ingest Records'}
            </button>
          </>
        }
      >
        <p style={{ fontSize: '14px', color: 'var(--text-main)', lineHeight: 1.5 }}>
          You are about to commit <strong>{valData?.validRows}</strong> validated transactions into the ledger for batch <strong>{batch?.batchReference}</strong>.
        </p>
        {valData && valData.rejectedRows > 0 && (
          <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', padding: '12px', borderRadius: '8px', fontSize: '13px', color: '#92400E', marginTop: '14px' }}>
            <strong>Note:</strong> {valData.rejectedRows} rejected rows and {valData.duplicateRows} duplicates will be discarded.
          </div>
        )}
      </Modal>
    </div>
  );
};
