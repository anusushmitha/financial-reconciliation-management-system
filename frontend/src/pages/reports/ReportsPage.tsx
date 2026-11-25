import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { ReconciliationReport, ExceptionReport } from '../../types';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import {
  BarChart3,
  Download,
  Calendar,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { SpotlightCard } from '../../components/reactbits/SpotlightCard';
import { AnimatedCounter } from '../../components/reactbits/AnimatedCounter';
import { CircularGauge } from '../../components/reactbits/CircularGauge';
import { ShinyText } from '../../components/reactbits/ShinyText';

export const ReportsPage: React.FC = () => {
  const [reconReport, setReconReport] = useState<ReconciliationReport | null>(null);
  const [exReport, setExReport] = useState<ExceptionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportingRecon, setExportingRecon] = useState(false);
  const [exportingEx, setExportingEx] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const [rRes, eRes] = await Promise.all([
        api.getReconciliationReport({ startDate: startDate || undefined, endDate: endDate || undefined }),
        api.getExceptionReport({ startDate: startDate || undefined, endDate: endDate || undefined }),
      ]);
      setReconReport(rRes);
      setExReport(eRes);
    } catch (err: any) {
      setError(err?.message || 'Failed to load report data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleExportRecon = async () => {
    try {
      setExportingRecon(true);
      const blob = await api.exportReconciliationReportCsv({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reconciliation_report_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.message || 'Failed to export reconciliation report.');
    } finally {
      setExportingRecon(false);
    }
  };

  const handleExportEx = async () => {
    try {
      setExportingEx(true);
      const blob = await api.exportExceptionReportCsv({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `exceptions_report_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.message || 'Failed to export exceptions report.');
    } finally {
      setExportingEx(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Date Filter & Export Bar */}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px', color: '#64748B' }}>From:</span>
            <input
              type="date"
              className="form-control"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ fontSize: '12px', padding: '6px 10px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px', color: '#64748B' }}>To:</span>
            <input
              type="date"
              className="form-control"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ fontSize: '12px', padding: '6px 10px' }}
            />
          </div>

          <button
            className="btn btn-secondary"
            onClick={loadReports}
            style={{ fontSize: '13px', padding: '6px 14px' }}
          >
            Apply Filters
          </button>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-secondary"
            onClick={handleExportRecon}
            disabled={exportingRecon}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
          >
            <Download size={14} />
            <span>{exportingRecon ? 'Exporting...' : 'Export Reconciliation CSV'}</span>
          </button>

          <button
            className="btn btn-secondary"
            onClick={handleExportEx}
            disabled={exportingEx}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
          >
            <Download size={14} />
            <span>{exportingEx ? 'Exporting...' : 'Export Exceptions CSV'}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: '24px' }}>
          <LoadingSkeleton rows={6} height="36px" />
        </div>
      ) : (
        <>
          {/* Section 1: Reconciliation Performance with React Bits Spotlight */}
          <SpotlightCard spotlightColor="rgba(37, 99, 235, 0.10)" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                Reconciliation Matching Performance
              </h3>
              <ShinyText text="Audit-Certified Metrics" speed={4} />
            </div>

            {reconReport && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px', alignItems: 'center' }}>
                <div style={{ padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: '12px', color: '#64748B', display: 'block', marginBottom: '4px' }}>Total Runs Evaluated</span>
                  <span style={{ fontSize: '24px', fontWeight: 700, color: '#1E293B', display: 'block' }}>
                    <AnimatedCounter end={reconReport.totals.runs} />
                  </span>
                </div>

                <div style={{ padding: '16px', backgroundColor: '#F0FDF4', borderRadius: '8px', border: '1px solid #BBF7D0' }}>
                  <span style={{ fontSize: '12px', color: '#166534', display: 'block', marginBottom: '4px' }}>Clean Matches</span>
                  <span style={{ fontSize: '24px', fontWeight: 700, color: '#16A34A', display: 'block' }}>
                    <AnimatedCounter end={reconReport.totals.matched} />
                  </span>
                </div>

                <div style={{ padding: '16px', backgroundColor: '#FEF2F2', borderRadius: '8px', border: '1px solid #FECACA' }}>
                  <span style={{ fontSize: '12px', color: '#991B1B', display: 'block', marginBottom: '4px' }}>Discrepancies Flagged</span>
                  <span style={{ fontSize: '24px', fontWeight: 700, color: '#DC2626', display: 'block' }}>
                    <AnimatedCounter end={reconReport.totals.exceptions} />
                  </span>
                </div>

                <div style={{ padding: '12px 16px', backgroundColor: '#EFF6FF', borderRadius: '8px', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--primary)', display: 'block', marginBottom: '2px', fontWeight: 600 }}>Overall Efficacy</span>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>Baseline threshold: 95%</span>
                  </div>
                  <CircularGauge value={reconReport.matchRate} size={70} strokeWidth={6} label="" color="var(--primary)" />
                </div>
              </div>
            )}
          </SpotlightCard>

          {/* Section 2: Exception Breakdown Chart */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 16px' }}>
              Exception Distribution by Discrepancy Type
            </h3>

            {exReport && exReport.byType && exReport.byType.length > 0 ? (
              <div style={{ width: '100%', height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={exReport.byType} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="type" stroke="#64748B" fontSize={11} angle={-15} textAnchor="end" />
                    <YAxis stroke="#64748B" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: '#0F172A', color: '#FFFFFF', borderRadius: '8px', border: 'none', fontSize: '12px' }} />
                    <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ padding: '30px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
                No exception types recorded within the selected period.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
