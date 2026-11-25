import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../services/api';
import { TransactionDetail } from '../../types';
import { StatusBadge } from '../../components/Badge';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import {
  ArrowLeft,
  FileText,
  Layers,
  AlertTriangle,
  Code2,
  Calendar,
  CreditCard,
  Hash,
} from 'lucide-react';

export const TransactionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [tx, setTx] = useState<TransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    const loadTx = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getTransaction(id);
        setTx(data);
      } catch (err: any) {
        setError(err?.message || 'Failed to load transaction details.');
      } finally {
        setLoading(false);
      }
    };
    loadTx();
  }, [id]);

  if (loading) {
    return (
      <div className="card" style={{ padding: '28px' }}>
        <LoadingSkeleton rows={6} height="36px" />
      </div>
    );
  }

  if (error || !tx) {
    return (
      <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
        <div style={{ color: '#DC2626', marginBottom: '16px' }}>{error || 'Transaction not found'}</div>
        <button className="btn btn-secondary" onClick={() => navigate('/transactions')}>
          <ArrowLeft size={16} />
          <span>Back to Transactions</span>
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Back button */}
      <div>
        <button
          className="btn btn-secondary"
          onClick={() => navigate('/transactions')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
        >
          <ArrowLeft size={16} />
          <span>Back to Transactions Ledger</span>
        </button>
      </div>

      {/* Main Metadata Card */}
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: '20px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-main)', fontFamily: 'monospace' }}>
                {tx.transactionReference}
              </h2>
              <StatusBadge status={tx.status} />
              <StatusBadge status={tx.sourceType} />
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '6px 0 0' }}>
              System Transaction ID: {tx.id}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Transaction Amount</span>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)' }}>
              {tx.currency} {Number(tx.amount).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Detailed Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              External Reference
            </span>
            <span style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'monospace' }}>
              {tx.externalReference || '—'}
            </span>
          </div>

          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Transaction Date
            </span>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>
              {new Date(tx.transactionDate).toLocaleDateString()}
            </span>
          </div>

          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Transaction Type
            </span>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>
              {tx.transactionType || 'GENERAL_TRANSACTION'}
            </span>
          </div>

          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Import Batch ID
            </span>
            <span style={{ fontSize: '13px', fontFamily: 'monospace', color: 'var(--primary)' }}>
              {tx.importBatchId}
            </span>
          </div>
        </div>
      </div>

      {/* Linked Reconciliation & Exceptions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Layers size={18} color="var(--primary)" />
            <h4 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Linked Reconciliation Matches</h4>
          </div>
          {tx.relatedMatchIds && tx.relatedMatchIds.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {tx.relatedMatchIds.map((mId) => (
                <li key={mId} style={{ padding: '8px 12px', backgroundColor: '#F8FAFC', borderRadius: '6px', fontSize: '13px', fontFamily: 'monospace' }}>
                  Match ID: {mId}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              No matches linked to this transaction record.
            </p>
          )}
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <AlertTriangle size={18} color="#DC2626" />
            <h4 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Linked Discrepancy Exceptions</h4>
          </div>
          {tx.relatedExceptionIds && tx.relatedExceptionIds.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {tx.relatedExceptionIds.map((exId) => (
                <li key={exId} style={{ padding: '8px 12px', backgroundColor: '#FEF2F2', borderRadius: '6px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'monospace', color: '#DC2626' }}>{exId}</span>
                  <Link to={`/exceptions/${exId}`} className="btn btn-secondary" style={{ fontSize: '11px', padding: '2px 8px' }}>
                    Open Exception
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              No open exceptions associated with this record.
            </p>
          )}
        </div>
      </div>

      {/* Raw Payload Card */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Code2 size={18} color="#64748B" />
          <h4 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Raw Parsed Payload</h4>
        </div>
        <pre
          style={{
            backgroundColor: '#0F172A',
            color: '#38BDF8',
            padding: '16px',
            borderRadius: '8px',
            fontSize: '12px',
            fontFamily: 'Consolas, Monaco, monospace',
            overflowX: 'auto',
            margin: 0,
          }}
        >
          {(() => {
            try {
              return JSON.stringify(JSON.parse(tx.rawData), null, 2);
            } catch {
              return tx.rawData;
            }
          })()}
        </pre>
      </div>
    </div>
  );
};
