import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { DashboardSummary, DashboardTrends, ExceptionSummary } from '../../types';
import { StatusBadge, SeverityBadge } from '../../components/Badge';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  TrendingUp,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { SpotlightCard } from '../../components/reactbits/SpotlightCard';
import { AnimatedCounter } from '../../components/reactbits/AnimatedCounter';

export const DashboardPage: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trends, setTrends] = useState<DashboardTrends | null>(null);
  const [recentExceptions, setRecentExceptions] = useState<ExceptionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  const loadData = async () => {
    try {
      setError(null);
      const [sumData, trendData, exData] = await Promise.all([
        api.getDashboardSummary(),
        api.getDashboardTrends('daily'),
        api.getExceptions({ page: 1, pageSize: 5 }),
      ]);
      setSummary(sumData);
      setTrends(trendData);
      setRecentExceptions(exData.items);
    } catch (err: any) {
      setError(err?.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) {
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '28px' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card" style={{ padding: '20px', height: '110px' }}>
              <LoadingSkeleton rows={2} height="20px" />
            </div>
          ))}
        </div>
        <div className="card" style={{ padding: '24px', height: '350px', marginBottom: '24px' }}>
          <LoadingSkeleton rows={6} height="36px" />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Real-time financial reconciliation overview and exception workload
          </span>
        </div>
        <button
          className="btn btn-secondary"
          onClick={handleRefresh}
          disabled={refreshing}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {error && (
        <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '12px 16px', borderRadius: '8px', fontSize: '14px' }}>
          {error}
        </div>
      )}

      {/* KPI Cards with React Bits Spotlight & Smooth Animated Counters */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '20px' }}>
          {/* Total Transactions */}
          <SpotlightCard
            spotlightColor="rgba(37, 99, 235, 0.12)"
            style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>Total Transactions</span>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#EFF6FF', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Layers size={18} />
              </div>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              <AnimatedCounter value={summary.totalTransactions} duration={800} />
            </div>
            <div style={{ fontSize: '12px', color: '#64748B' }}>
              Internal & External records
            </div>
          </SpotlightCard>

          {/* Matched Transactions */}
          <SpotlightCard
            spotlightColor="rgba(22, 163, 74, 0.12)"
            style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>Matched</span>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#F0FDF4', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={18} />
              </div>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 700, color: '#16A34A', letterSpacing: '-0.02em' }}>
              <AnimatedCounter value={summary.matchedTransactions} duration={850} />
            </div>
            <div style={{ fontSize: '12px', color: '#16A34A', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <TrendingUp size={14} />
              <span>
                <AnimatedCounter value={summary.matchRate} decimals={1} duration={950} suffix="% Match Rate" />
              </span>
            </div>
          </SpotlightCard>

          {/* Open Exceptions */}
          <SpotlightCard
            spotlightColor="rgba(220, 38, 38, 0.12)"
            style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>Open Exceptions</span>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={18} />
              </div>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 700, color: '#DC2626', letterSpacing: '-0.02em' }}>
              <AnimatedCounter value={summary.openExceptions} duration={800} />
            </div>
            <div style={{ fontSize: '12px', color: '#DC2626' }}>
              Requiring investigation
            </div>
          </SpotlightCard>

          {/* Resolved Exceptions */}
          <SpotlightCard
            spotlightColor="rgba(100, 116, 139, 0.12)"
            style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>Resolved Discrepancies</span>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#F8FAFC', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={18} />
              </div>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              <AnimatedCounter value={summary.resolvedExceptions} duration={850} />
            </div>
            <div style={{ fontSize: '12px', color: '#64748B' }}>
              Human sign-off complete
            </div>
          </SpotlightCard>

          {/* Unmatched / Pending */}
          <SpotlightCard
            spotlightColor="rgba(217, 119, 6, 0.12)"
            style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>Unmatched / Pending</span>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#FFFBEB', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ArrowUpRight size={18} />
              </div>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 700, color: '#D97706', letterSpacing: '-0.02em' }}>
              <AnimatedCounter value={summary.unmatchedTransactions} duration={800} />
            </div>
            <div style={{ fontSize: '12px', color: '#D97706' }}>
              Awaiting reconciliation
            </div>
          </SpotlightCard>
        </div>
      )}

      {/* Analytics Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        {/* Trend Area Chart */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                Reconciliation Volume Trends
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Daily matched volume vs detected discrepancy exceptions
              </p>
            </div>
          </div>
          <div style={{ width: '100%', height: '280px' }}>
            {trends && trends.items && trends.items.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends.items} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorMatched" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16A34A" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#16A34A" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExceptions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#DC2626" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#DC2626" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="period" stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#0F172A', color: '#FFFFFF', borderRadius: '8px', border: 'none', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="matched" name="Matched" stroke="#16A34A" strokeWidth={2} fillOpacity={1} fill="url(#colorMatched)" />
                  <Area type="monotone" dataKey="exceptions" name="Exceptions" stroke="#DC2626" strokeWidth={2} fillOpacity={1} fill="url(#colorExceptions)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '13px' }}>
                No trend data recorded yet. Run reconciliation batches to view metrics.
              </div>
            )}
          </div>
        </div>

        {/* Operational Ratios Bar Chart */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
              Reconciliation Distribution
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Execution status composition
            </p>
          </div>
          <div style={{ width: '100%', height: '280px' }}>
            {summary && (summary.matchedTransactions > 0 || summary.openExceptions > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: 'Matched', count: summary.matchedTransactions, fill: '#16A34A' },
                    { name: 'Open Exceptions', count: summary.openExceptions, fill: '#DC2626' },
                    { name: 'Resolved', count: summary.resolvedExceptions, fill: '#2563EB' },
                  ]}
                  layout="vertical"
                  margin={{ top: 10, right: 20, left: 20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis type="number" stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <YAxis dataKey="name" type="category" stroke="#64748B" fontSize={11} tickLine={false} width={100} />
                  <Tooltip contentStyle={{ backgroundColor: '#0F172A', color: '#FFFFFF', borderRadius: '8px', border: 'none', fontSize: '12px' }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '13px', textAlign: 'center' }}>
                Run reconciliation to generate distribution ratios.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Exceptions Table */}
      <div className="card">
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
              Recent Discrepancy Exceptions
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Discrepancies flagged by deterministic matching rules requiring analyst review
            </p>
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/exceptions')}
            style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>View All Exceptions</span>
            <ExternalLink size={14} />
          </button>
        </div>

        {recentExceptions.length === 0 ? (
          <EmptyState
            title="No Exceptions Detected"
            description="All processed transactions have either matched cleanly or no runs have been executed yet."
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Exception ID</th>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Discrepancy</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentExceptions.map((ex) => (
                  <tr key={ex.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/exceptions/${ex.id}`)}>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
