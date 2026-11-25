import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { StatusBadge } from './Badge';
import { Modal } from './Modal';
import {
  Bell,
  Search,
  Sliders,
  RotateCcw,
  Compass,
  Sparkles,
  ExternalLink,
  CheckCheck,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ShinyText } from './reactbits/ShinyText';

interface TopbarProps {
  title: string;
  subtitle?: string;
  onOpenCommandPalette?: () => void;
  isCompact?: boolean;
  onToggleDensity?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  title,
  subtitle,
  onOpenCommandPalette,
  isCompact = false,
  onToggleDensity,
}) => {
  const { user, login } = useAuth();
  const { addToast, history, unreadCount, markAllRead, clearHistory } = useToast();
  const navigate = useNavigate();
  const [showTour, setShowTour] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [clusterStatus, setClusterStatus] = useState<{ status: string; latencyMs: number | null }>({
    status: 'Healthy',
    latencyMs: null,
  });

  useEffect(() => {
    let active = true;
    const probe = async () => {
      const start = performance.now();
      try {
        const res = await api.getReadiness();
        const totalMs = Math.round(performance.now() - start);
        if (active) {
          setClusterStatus({
            status: res.status || 'Healthy',
            latencyMs: typeof res.aiLatencyMs === 'number' ? res.aiLatencyMs : totalMs,
          });
        }
      } catch {
        if (active) {
          setClusterStatus({ status: 'Offline', latencyMs: null });
        }
      }
    };
    probe();
    const timer = setInterval(probe, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const executeResetDemo = async () => {
    try {
      setResetting(true);
      const res = await api.resetDemoSeed();
      setShowConfirmReset(false);
      addToast(res?.message || 'Demo data re-seeded successfully', 'success');
      setTimeout(() => window.location.reload(), 800);
    } catch (err: any) {
      addToast(err?.message || 'Failed to reset demo data', 'error');
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      <header
      style={{
        height: '64px',
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 28px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.01em' }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
            {subtitle}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Astryx Omnibar Quick Search Trigger */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            borderRadius: '8px',
            border: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            color: '#64748B',
            fontSize: '12px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          title="Open Command Palette (Ctrl+K)"
        >
          <Search size={14} style={{ color: 'var(--primary)' }} />
          <span style={{ fontWeight: 500 }}>Search or jump to...</span>
          <kbd
            style={{
              fontSize: '10px',
              fontFamily: 'monospace',
              padding: '1px 5px',
              borderRadius: '4px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              color: '#475569',
              fontWeight: 600,
            }}
          >
            Ctrl K
          </kbd>
        </button>

        {/* Astryx Table Density Switcher */}
        {onToggleDensity && (
          <button
            type="button"
            onClick={onToggleDensity}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              borderRadius: '8px',
              border: isCompact ? '1px solid var(--primary)' : '1px solid #E2E8F0',
              backgroundColor: isCompact ? 'rgba(37, 99, 235, 0.08)' : '#FFFFFF',
              color: isCompact ? 'var(--primary)' : '#64748B',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            title={isCompact ? 'Current: Compact Mode (Dense rows). Click for Comfortable.' : 'Current: Comfortable Mode. Click for Compact.'}
          >
            <Sliders size={13} />
            <span>{isCompact ? 'Density: Compact' : 'Density: Normal'}</span>
          </button>
        )}

        {/* Live Telemetry Cluster Readiness Indicator */}
        {(() => {
          const isOnline = clusterStatus.status === 'Healthy';
          const isDegraded = clusterStatus.status === 'Degraded';
          const bg = isOnline ? '#F0FDF4' : isDegraded ? '#FEF3C7' : '#FEF2F2';
          const border = isOnline ? '#BBF7D0' : isDegraded ? '#FDE68A' : '#FECACA';
          const dot = isOnline ? '#16A34A' : isDegraded ? '#D97706' : '#DC2626';
          const fg = isOnline ? '#166534' : isDegraded ? '#92400E' : '#991B1B';
          const label = isOnline
            ? `AI CLUSTER ONLINE • ${clusterStatus.latencyMs ?? 12}ms`
            : isDegraded
              ? 'AI SERVICE DEGRADED'
              : 'CLUSTER OFFLINE';

          return (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: bg,
                padding: '5px 12px',
                borderRadius: '20px',
                border: `1px solid ${border}`,
              }}
              title="Live Postgres + FastAPI AI Microservice Health Ping"
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: dot,
                  display: 'inline-block',
                  boxShadow: `0 0 8px ${dot}`,
                }}
              />
              <span style={{ fontSize: '12px', fontWeight: 700, color: fg, letterSpacing: '0.02em' }}>
                <ShinyText text={label} speed={3} />
              </span>
            </div>
          );
        })()}

        {/* Persistent SignalR & Event Notification Bell */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => {
              const next = !showNotifications;
              setShowNotifications(next);
              if (next) markAllRead();
            }}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              backgroundColor: showNotifications ? '#EFF6FF' : '#FFFFFF',
              color: showNotifications ? 'var(--primary)' : '#475569',
              cursor: 'pointer',
            }}
            title="Live Notifications & Event Feed"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  minWidth: '16px',
                  height: '16px',
                  borderRadius: '999px',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontSize: '10px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div
              style={{
                position: 'absolute',
                top: '42px',
                right: 0,
                width: '340px',
                maxHeight: '420px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.12)',
                zIndex: 120,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '12px 14px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                  Notification Feed ({history.length})
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={markAllRead}
                    style={{ border: 'none', background: 'none', fontSize: '11px', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                  >
                    <CheckCheck size={12} /> Read
                  </button>
                  <button
                    type="button"
                    onClick={clearHistory}
                    style={{ border: 'none', background: 'none', fontSize: '11px', color: '#64748B', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                  >
                    <Trash2 size={12} /> Clear
                  </button>
                </div>
              </div>
              <div style={{ overflowY: 'auto', maxHeight: '350px' }}>
                {history.length === 0 ? (
                  <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: '12px', color: '#94A3B8' }}>
                    No recent notifications. Live SignalR events and workflow alerts appear here.
                  </div>
                ) : (
                  history.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid #F1F5F9',
                        backgroundColor: item.read ? '#FFFFFF' : '#F8FAFC',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#1E293B' }}>{item.title}</span>
                        <span style={{ fontSize: '10px', color: '#94A3B8' }}>
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B', lineHeight: 1.4 }}>{item.message}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Showcase Tour & Architecture Guide */}
        <button
          type="button"
          onClick={() => setShowTour(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 11px',
            borderRadius: '8px',
            border: '1px solid #CBD5E1',
            backgroundColor: '#FFFFFF',
            color: '#1E293B',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          title="Open Architecture & Feature Walkthrough Tour"
        >
          <Compass size={14} style={{ color: 'var(--primary)' }} />
          <span>Showcase Tour</span>
        </button>

        {/* Quick Demo Re-Seed */}
        <button
          type="button"
          onClick={() => setShowConfirmReset(true)}
          disabled={resetting}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 11px',
            borderRadius: '8px',
            border: '1px solid #FCD34D',
            backgroundColor: '#FEF3C7',
            color: '#92400E',
            fontSize: '12px',
            fontWeight: 600,
            cursor: resetting ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
          }}
          title="Reset database to curated flagship exceptions and assignments"
        >
          <RotateCcw size={13} style={{ transform: resetting ? 'rotate(180deg)' : 'none', transition: 'transform 0.5s ease' }} />
          <span>{resetting ? 'Resetting...' : 'Re-Seed Demo'}</span>
        </button>

        {/* Quick Demo Persona Switcher */}
        <select
          onChange={async (e) => {
            const val = e.target.value;
            if (!val) return;
            try {
              if (val === 'admin') {
                await login('staging.admin@lendguard.internal', 'StagingAdmin_Secure2026!');
              } else if (val === 'op_analyst') {
                await login('staging.analyst@lendguard.internal', 'StagingAnalyst_Secure2026!');
              } else if (val === 'anu') {
                await login('sanushusmitha@gmail.com', 'Analyst123!');
              }
              window.location.reload();
            } catch (err) {
              console.error('Failed to switch persona', err);
            }
          }}
          value=""
          style={{
            fontSize: '11px',
            fontWeight: 600,
            padding: '5px 8px',
            borderRadius: '6px',
            border: '1px solid #CBD5E1',
            backgroundColor: '#F8FAFC',
            color: '#334155',
            cursor: 'pointer',
          }}
          title="Switch Active Persona Instantly"
        >
          <option value="" disabled>
            ⚡ Switch Persona
          </option>
          <option value="admin">Admin (Full Control)</option>
          <option value="op_analyst">Operational Analyst</option>
          <option value="anu">Anu Sushmitha (Analyst)</option>
        </select>

        {/* User Card */}
        {user && (
          <div
            onClick={() => navigate('/profile')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '6px 10px',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
            title="View Profile"
          >
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: '13px',
              }}
            >
              {user.fullName ? user.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'U'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.2 }}>
                {user.fullName}
              </span>
              <div style={{ marginTop: '2px' }}>
                <StatusBadge status={user.role} size="sm" />
              </div>
            </div>
          </div>
        )}
      </div>
    </header>

    {/* Showcase Architectural Tour Modal */}
    {showTour && (
      <Modal
        isOpen={showTour}
        onClose={() => setShowTour(false)}
        title="LendGuard Enterprise Architecture & Feature Walkthrough"
        maxWidth="800px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ padding: '14px 18px', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', fontSize: '13px', color: '#1E40AF', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={20} style={{ flexShrink: 0, color: 'var(--primary)' }} />
            <span>
              Welcome to <strong>LendGuard</strong> — the enterprise autonomous financial reconciliation platform designed to eliminate multi-million dollar ledger breaks, prevent leakage, and enforce real-time auditability.
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Step 1 */}
            <div style={{ padding: '16px', border: '1px solid #E2E8F0', borderRadius: '8px', backgroundColor: '#F8FAFC', display: 'flex', gap: '14px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>
                1
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px', color: '#0F172A' }}>
                  High-Throughput Ingestion & Pre-Flight Validation
                </h4>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 8px', lineHeight: 1.5 }}>
                  Browser-side chunk parsing inspects CSV headers and types before transmission. The backend applies streaming deduplication using SHA-256 batch hash-locking to guarantee idempotency.
                </p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setShowTour(false); navigate('/imports'); }}
                  style={{ fontSize: '11px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <span>Go to Ingestion Pipeline</span>
                  <ExternalLink size={12} />
                </button>
              </div>
            </div>

            {/* Step 2 */}
            <div style={{ padding: '16px', border: '1px solid #E2E8F0', borderRadius: '8px', backgroundColor: '#F8FAFC', display: 'flex', gap: '14px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#0284C7', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>
                2
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px', color: '#0F172A' }}>
                  Multi-Pass Deterministic Matching & Dynamic Rules
                </h4>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 8px', lineHeight: 1.5 }}>
                  Multi-tier matching pipeline evaluates exact references, amount variance tolerance (0-2% or ₹0-250 cap), and transaction settlement date slippage windows (0-7 days).
                </p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setShowTour(false); navigate('/rules'); }}
                  style={{ fontSize: '11px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <span>Configure Reconciliation Rules</span>
                  <ExternalLink size={12} />
                </button>
              </div>
            </div>

            {/* Step 3 */}
            <div style={{ padding: '16px', border: '1px solid #E2E8F0', borderRadius: '8px', backgroundColor: '#F8FAFC', display: 'flex', gap: '14px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#7C3AED', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>
                3
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px', color: '#0F172A' }}>
                  Dual-Engine AI Intelligence (IsolationForest + NVIDIA NIM)
                </h4>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 8px', lineHeight: 1.5 }}>
                  <strong>Engine 1:</strong> Scikit-learn IsolationForest ML model computes calibrated multidimensional outlier anomaly scores with SHAP-based feature attributions. <strong>Engine 2:</strong> NVIDIA NIM Generative Explainer provides causal root-cause reasoning and remediation guidance.
                </p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setShowTour(false); navigate('/exceptions'); }}
                  style={{ fontSize: '11px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <span>Explore Exception Queue</span>
                  <ExternalLink size={12} />
                </button>
              </div>
            </div>

            {/* Step 4 */}
            <div style={{ padding: '16px', border: '1px solid #E2E8F0', borderRadius: '8px', backgroundColor: '#F8FAFC', display: 'flex', gap: '14px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#D97706', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>
                4
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px', color: '#0F172A' }}>
                  Prescriptive Accounting Journals & Resolution Workflows
                </h4>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 8px', lineHeight: 1.5 }}>
                  Every flagged discrepancy generates a balanced double-entry General Ledger journal suggestion (GAAP/IFRS compliant). Analysts claim cases, attach investigation notes, and sign off with immutable audit logs.
                </p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setShowTour(false); navigate('/reports'); }}
                  style={{ fontSize: '11px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <span>View Reports & Executive Dossier</span>
                  <ExternalLink size={12} />
                </button>
              </div>
            </div>

            {/* Step 5 */}
            <div style={{ padding: '16px', border: '1px solid #E2E8F0', borderRadius: '8px', backgroundColor: '#F8FAFC', display: 'flex', gap: '14px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#16A34A', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>
                5
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px', color: '#0F172A' }}>
                  Real-Time SignalR WebSockets & Audit Attestation
                </h4>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '0', lineHeight: 1.5 }}>
                  Live push updates via SignalR notify analysts instantly of reassignments, resolutions, and system events. Complete SOC-1 / ISO-20022 compliance dossiers can be exported and printed in one click.
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '10px', borderTop: '1px solid #E2E8F0' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowTour(false)}
            >
              Start Exploring LendGuard
            </button>
          </div>
        </div>
      </Modal>
    )}

    {/* Non-Blocking Astryx Demo Re-Seed Confirmation Modal */}
    {showConfirmReset && (
      <Modal
        isOpen={showConfirmReset}
        onClose={() => setShowConfirmReset(false)}
        title="Confirm Showcase Demo Reset"
        maxWidth="460px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '13px', color: '#475569', margin: 0, lineHeight: 1.5 }}>
            Restore the database to the curated demonstration baseline (5 flagship exceptions distributed across Anu Sushmitha, Operational Analyst, and unassigned outlier queue)?
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowConfirmReset(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={resetting}
              onClick={executeResetDemo}
              style={{ backgroundColor: '#D97706', borderColor: '#D97706', color: '#FFFFFF' }}
            >
              {resetting ? 'Re-Seeding...' : 'Confirm Reset'}
            </button>
          </div>
        </div>
      </Modal>
    )}
  </>
  );
};
