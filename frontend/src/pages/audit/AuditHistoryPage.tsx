import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { AuditLog } from '../../types';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldCheck,
  Search,
  ChevronLeft,
  ChevronRight,
  Code,
  Lock,
} from 'lucide-react';
import { SpotlightCard } from '../../components/reactbits/SpotlightCard';
import { AnimatedCounter } from '../../components/reactbits/AnimatedCounter';
import { DecryptedText } from '../../components/reactbits/DecryptedText';
import { ShinyText } from '../../components/reactbits/ShinyText';

export const AuditHistoryPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  // Payload modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getAuditLogs({
        action: action || undefined,
        entityType: entityType || undefined,
        page,
        pageSize,
      });
      setLogs(res.items);
      setTotalCount(res.totalCount);
    } catch (err: any) {
      setError(err?.message || 'Failed to load audit history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadLogs();
    }
  }, [isAdmin, action, entityType, page]);

  if (!isAdmin) {
    return (
      <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
        <Lock size={40} style={{ color: '#DC2626', margin: '0 auto 16px' }} />
        <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 8px' }}>
          Restricted Compliance Area
        </h3>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto' }}>
          Access to immutable audit history is strictly limited to Administrator roles.
        </p>
      </div>
    );
  }

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Filters */}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
        <input
          type="text"
          className="form-control"
          placeholder="Filter by action code (e.g. EXCEPTION_RESOLVED)..."
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          style={{ width: '280px', fontSize: '13px' }}
        />

        <input
          type="text"
          className="form-control"
          placeholder="Filter by entity type (e.g. DiscrepancyException)..."
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value);
            setPage(1);
          }}
          style={{ width: '280px', fontSize: '13px' }}
        />

        {(action || entityType) && (
          <button
            className="btn btn-secondary"
            onClick={() => {
              setAction('');
              setEntityType('');
              setPage(1);
            }}
            style={{ fontSize: '13px' }}
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '12px 16px', borderRadius: '8px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* Audit Log Table with React Bits Spotlight & Cryptographic Tokens */}
      <SpotlightCard spotlightColor="rgba(56, 189, 248, 0.08)">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>Tamper-Evident System Audit Trail (</span>
              <AnimatedCounter end={totalCount} />
              <span> events recorded)</span>
            </span>
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0', fontWeight: 600 }}>
              SHA-256 Ledger Lock Active
            </span>
          </div>
          <ShinyText text="SOX 404 / Basel III Compliant" speed={5} />
        </div>

        {loading ? (
          <div style={{ padding: '20px' }}>
            <LoadingSkeleton rows={8} height="42px" />
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No Audit Events Found"
            description="No audit logs match the provided criteria."
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor</th>
                  <th>Action Code</th>
                  <th>Entity Type</th>
                  <th>Entity ID</th>
                  <th style={{ textAlign: 'right' }}>Payload Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontSize: '12px', color: '#64748B', whiteSpace: 'nowrap' }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td style={{ fontWeight: 600, fontSize: '13px' }}>
                      {log.actorName || 'System Service'}
                    </td>
                    <td>
                      <span style={{ backgroundColor: '#F1F5F9', color: '#334155', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace', fontWeight: 600 }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ fontSize: '13px', color: 'var(--text-main)' }}>
                      {log.entityType}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px', color: '#64748B' }}>
                      {log.entityId ? (
                        <DecryptedText text={`${log.entityId.slice(0, 10)}...`} speed={25} />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {log.details ? (
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                          onClick={() => setSelectedLog(log)}
                        >
                          <Code size={14} />
                        </button>
                      ) : (
                        <span style={{ color: '#CBD5E1', fontSize: '12px' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
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
      </SpotlightCard>

      {/* Payload Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Audit Event Payload Details"
        description={`Event ID: ${selectedLog?.id} • Action: ${selectedLog?.action}`}
        footer={
          <button className="btn btn-secondary" onClick={() => setSelectedLog(null)}>
            Close
          </button>
        }
      >
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
            maxHeight: '400px',
          }}
        >
          {JSON.stringify(selectedLog?.details, null, 2)}
        </pre>
      </Modal>
    </div>
  );
};
