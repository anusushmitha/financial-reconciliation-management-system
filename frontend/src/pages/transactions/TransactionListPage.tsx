import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { TransactionSummary } from '../../types';
import { StatusBadge } from '../../components/Badge';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { Search, Filter, ArrowLeftRight, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { SpotlightCard } from '../../components/reactbits/SpotlightCard';
import { DecryptedText } from '../../components/reactbits/DecryptedText';
import { AnimatedCounter } from '../../components/reactbits/AnimatedCounter';

export const TransactionListPage: React.FC = () => {
  const [transactions, setTransactions] = useState<TransactionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [sourceType, setSourceType] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalCount, setTotalCount] = useState(0);

  const navigate = useNavigate();

  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getTransactions({
        search: search.trim() || undefined,
        sourceType: sourceType ? (sourceType as 'INTERNAL' | 'EXTERNAL') : undefined,
        status: status || undefined,
        page,
        pageSize,
      });
      setTransactions(res.items);
      setTotalCount(res.totalCount);
    } catch (err: any) {
      setError(err?.message || 'Failed to load transactions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [page, sourceType, status]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadTransactions();
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Filter Bar */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: '#94A3B8' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search reference or external ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '36px', fontSize: '13px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <select
              className="form-control"
              value={sourceType}
              onChange={(e) => {
                setSourceType(e.target.value);
                setPage(1);
              }}
              style={{ fontSize: '13px', width: '150px' }}
            >
              <option value="">All Sources</option>
              <option value="INTERNAL">Internal Ledger</option>
              <option value="EXTERNAL">External Bank</option>
            </select>

            <select
              className="form-control"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              style={{ fontSize: '13px', width: '160px' }}
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="MATCHED">Matched</option>
              <option value="EXCEPTION">Exception</option>
              <option value="UNMATCHED">Unmatched</option>
            </select>

            <button type="submit" className="btn btn-primary" style={{ fontSize: '13px', padding: '8px 16px' }}>
              Search
            </button>
            {(search || sourceType || status) && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '13px', padding: '8px 14px' }}
                onClick={() => {
                  setSearch('');
                  setSourceType('');
                  setStatus('');
                  setPage(1);
                }}
              >
                Reset
              </button>
            )}
          </div>
        </form>
      </div>

      {error && (
        <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '12px 16px', borderRadius: '8px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* Transaction Table with React Bits Spotlight */}
      <SpotlightCard spotlightColor="rgba(37, 99, 235, 0.06)">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>Showing {transactions.length} of </span>
            <AnimatedCounter value={totalCount} />
            <span> transactions</span>
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '20px' }}>
            <LoadingSkeleton rows={8} height="42px" />
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState
            icon={ArrowLeftRight}
            title="No Transactions Found"
            description="No transactions match your current search and filter criteria. Try uploading a CSV batch or clearing filters."
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Source</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>External Ref</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/transactions/${tx.id}`)}
                  >
                    <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary)' }}>
                      <DecryptedText text={tx.transactionReference} speed={25} />
                    </td>
                    <td>
                      <StatusBadge status={tx.sourceType} size="sm" />
                    </td>
                    <td style={{ fontSize: '13px', color: '#475569' }}>
                      {tx.transactionType || 'TRANSACTION'}
                    </td>
                    <td style={{ fontSize: '13px', color: '#475569' }}>
                      {new Date(tx.transactionDate).toLocaleDateString()}
                    </td>
                    <td style={{ fontWeight: 600, fontSize: '13px' }}>
                      {tx.currency} {Number(tx.amount).toFixed(2)}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px', color: '#64748B' }}>
                      {tx.externalReference || '—'}
                    </td>
                    <td>
                      <StatusBadge status={tx.status} size="sm" />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/transactions/${tx.id}`);
                        }}
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
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
                style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <ChevronLeft size={14} />
                <span>Previous</span>
              </button>
              <button
                className="btn btn-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </SpotlightCard>
    </div>
  );
};
