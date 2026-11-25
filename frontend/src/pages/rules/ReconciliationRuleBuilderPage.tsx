import React, { useState, useEffect } from 'react';
import { Sliders, Shield, Save, RotateCcw, Layers, Percent, Calendar, Sparkles } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { SpotlightCard } from '../../components/reactbits/SpotlightCard';

interface MatchingPolicy {
  amountTolerancePercent: number;
  fixedRupeeTolerance: number;
  dateSlippageDays: number;
  fuzzyReferenceMatching: boolean;
  fuzzyThreshold: number;
  autoReconConfidence: number;
  isolationForestOutlierThreshold: number;
  multiCurrencyHandling: boolean;
  selectedPreset: 'strict' | 'balanced' | 'fintech' | 'custom';
}

const DEFAULT_POLICY: MatchingPolicy = {
  amountTolerancePercent: 0.05,
  fixedRupeeTolerance: 10.0,
  dateSlippageDays: 3,
  fuzzyReferenceMatching: true,
  fuzzyThreshold: 85,
  autoReconConfidence: 95,
  isolationForestOutlierThreshold: 0.75,
  multiCurrencyHandling: true,
  selectedPreset: 'balanced',
};

export const ReconciliationRuleBuilderPage: React.FC = () => {
  const { showToast } = useToast();
  const { isAdmin } = useAuth();
  const [policy, setPolicy] = useState<MatchingPolicy>(() => {
    const saved = localStorage.getItem('lendguard_matching_policy');
    return saved ? JSON.parse(saved) : DEFAULT_POLICY;
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    api.getPolicy().then((remote) => {
      if (!mounted) return;
      const merged: MatchingPolicy = {
        amountTolerancePercent: Number(remote.amountTolerancePercent ?? 0),
        fixedRupeeTolerance: Number(remote.fixedRupeeTolerance ?? 0),
        dateSlippageDays: Number(remote.dateSlippageDays ?? 0),
        fuzzyReferenceMatching: Boolean(remote.fuzzyReferenceMatching),
        fuzzyThreshold: Number(remote.fuzzyThreshold ?? 85),
        autoReconConfidence: Number(remote.autoReconConfidence ?? 95),
        isolationForestOutlierThreshold: Number(remote.isolationForestOutlierThreshold ?? 0.75),
        multiCurrencyHandling: Boolean(remote.multiCurrencyHandling),
        selectedPreset: remote.selectedPreset || 'strict',
      };
      setPolicy(merged);
      localStorage.setItem('lendguard_matching_policy', JSON.stringify(merged));
    }).catch(() => {
      // Keep local cache silently if offline
    });
    return () => { mounted = false; };
  }, []);

  const applyPreset = (preset: 'strict' | 'balanced' | 'fintech') => {
    if (preset === 'strict') {
      setPolicy({
        amountTolerancePercent: 0.0,
        fixedRupeeTolerance: 0.0,
        dateSlippageDays: 0,
        fuzzyReferenceMatching: false,
        fuzzyThreshold: 100,
        autoReconConfidence: 99,
        isolationForestOutlierThreshold: 0.6,
        multiCurrencyHandling: false,
        selectedPreset: 'strict',
      });
      showToast('Strict Policy Applied', 'Zero tolerance configured for core banking regulatory adherence.', 'info');
    } else if (preset === 'balanced') {
      setPolicy({
        ...DEFAULT_POLICY,
        selectedPreset: 'balanced',
      });
      showToast('Balanced Commercial Policy', 'Industry standard ±0.05% with 3-day weekend buffer active.', 'info');
    } else if (preset === 'fintech') {
      setPolicy({
        amountTolerancePercent: 0.25,
        fixedRupeeTolerance: 50.0,
        dateSlippageDays: 5,
        fuzzyReferenceMatching: true,
        fuzzyThreshold: 75,
        autoReconConfidence: 90,
        isolationForestOutlierThreshold: 0.85,
        multiCurrencyHandling: true,
        selectedPreset: 'fintech',
      });
      showToast('High-Velocity Fintech Policy', 'Relaxed matching thresholds for rapid digital micro-lending transactions.', 'info');
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      localStorage.setItem('lendguard_matching_policy', JSON.stringify(policy));
      if (isAdmin) {
        await api.updatePolicy({
          profileId: policy.selectedPreset,
          amountTolerancePercent: policy.amountTolerancePercent,
          fixedRupeeTolerance: policy.fixedRupeeTolerance,
          dateSlippageDays: policy.dateSlippageDays,
          fuzzyReferenceMatching: policy.fuzzyReferenceMatching,
          fuzzyThreshold: policy.fuzzyThreshold,
          autoReconConfidence: policy.autoReconConfidence,
          isolationForestOutlierThreshold: policy.isolationForestOutlierThreshold,
          multiCurrencyHandling: policy.multiCurrencyHandling,
        });
        showToast('Policy Persisted to Database', 'PostgreSQL & Reconciliation engine synchronized cleanly.', 'success');
      } else {
        showToast('Policy Preview Updated', 'Read-only preview saved locally (Admin role persists institution rules).', 'info');
      }
    } catch (err: any) {
      showToast('Policy Sync Error', err?.message || 'Failed to save rule policy to database.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const strictBaseline: MatchingPolicy = {
      ...DEFAULT_POLICY,
      amountTolerancePercent: 0.0,
      fixedRupeeTolerance: 0.0,
      dateSlippageDays: 0,
      selectedPreset: 'strict',
    };
    setPolicy(strictBaseline);
    localStorage.setItem('lendguard_matching_policy', JSON.stringify(strictBaseline));
    if (isAdmin) {
      try {
        await api.updatePolicy({
          profileId: 'strict',
          amountTolerancePercent: 0,
          fixedRupeeTolerance: 0,
          dateSlippageDays: 0,
          fuzzyReferenceMatching: true,
          fuzzyThreshold: 85,
          autoReconConfidence: 95,
          isolationForestOutlierThreshold: 0.75,
          multiCurrencyHandling: true,
        });
      } catch {
        // Ignore if network busy
      }
    }
    showToast('Reset to Strict Baseline', 'Matching rules restored to zero-tolerance audit baseline.', 'info');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={22} style={{ color: 'var(--primary)' }} />
            <span>Reconciliation Policy & Rule Engine</span>
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
            Configure real-time algorithmic tolerance, date slippage windows, and AI outlier detection sensitivity.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleReset} className="btn btn-secondary" style={{ fontSize: '13px' }}>
            <RotateCcw size={14} />
            <span>Restore Defaults</span>
          </button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ fontSize: '13px' }}>
            <Save size={14} />
            <span>{saving ? 'Synchronizing...' : 'Save & Calibrate Engine'}</span>
          </button>
        </div>
      </div>

      {/* Preset Profiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
        <SpotlightCard
          className="card"
          spotlightColor="rgba(37, 99, 235, 0.15)"
          style={{
            padding: '16px',
            border: policy.selectedPreset === 'strict' ? '2px solid var(--primary)' : '1px solid var(--border)',
            cursor: 'pointer',
          }}
          onClick={() => applyPreset('strict')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontWeight: 700, fontSize: '14px', color: '#1E293B' }}>Strict Banking Policy</span>
            <Shield size={16} style={{ color: '#DC2626' }} />
          </div>
          <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 10px', lineHeight: 1.4 }}>
            0% tolerance, 0-day slippage. Flags every cent for audit perfection.
          </p>
          <span style={{ fontSize: '11px', fontWeight: 600, color: policy.selectedPreset === 'strict' ? 'var(--primary)' : '#94A3B8' }}>
            {policy.selectedPreset === 'strict' ? '● Active Profile' : 'Click to apply'}
          </span>
        </SpotlightCard>

        <SpotlightCard
          className="card"
          spotlightColor="rgba(22, 163, 74, 0.15)"
          style={{
            padding: '16px',
            border: policy.selectedPreset === 'balanced' ? '2px solid #16A34A' : '1px solid var(--border)',
            cursor: 'pointer',
          }}
          onClick={() => applyPreset('balanced')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontWeight: 700, fontSize: '14px', color: '#1E293B' }}>Commercial Balanced</span>
            <Sparkles size={16} style={{ color: '#16A34A' }} />
          </div>
          <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 10px', lineHeight: 1.4 }}>
            ±0.05% tolerance (₹10 cap), 3-day settlement window for clearing buffers.
          </p>
          <span style={{ fontSize: '11px', fontWeight: 600, color: policy.selectedPreset === 'balanced' ? '#16A34A' : '#94A3B8' }}>
            {policy.selectedPreset === 'balanced' ? '● Active Profile (Recommended)' : 'Click to apply'}
          </span>
        </SpotlightCard>

        <SpotlightCard
          className="card"
          spotlightColor="rgba(147, 51, 234, 0.15)"
          style={{
            padding: '16px',
            border: policy.selectedPreset === 'fintech' ? '2px solid #9333EA' : '1px solid var(--border)',
            cursor: 'pointer',
          }}
          onClick={() => applyPreset('fintech')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontWeight: 700, fontSize: '14px', color: '#1E293B' }}>High-Velocity Fintech</span>
            <Layers size={16} style={{ color: '#9333EA' }} />
          </div>
          <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 10px', lineHeight: 1.4 }}>
            ±0.25% variance, 5-day slippage, and heuristic fuzzy matching.
          </p>
          <span style={{ fontSize: '11px', fontWeight: 600, color: policy.selectedPreset === 'fintech' ? '#9333EA' : '#94A3B8' }}>
            {policy.selectedPreset === 'fintech' ? '● Active Profile' : 'Click to apply'}
          </span>
        </SpotlightCard>
      </div>

      {/* Interactive Policy Configuration Sliders */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* Card 1: Amount & Variance Rules */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>
            <Percent size={18} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Amount Variance & Tolerance Thresholds
            </h3>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                Percentage Variance Tolerance
              </label>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }}>
                {policy.amountTolerancePercent.toFixed(2)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="2.0"
              step="0.01"
              value={policy.amountTolerancePercent}
              onChange={(e) => setPolicy({ ...policy, amountTolerancePercent: parseFloat(e.target.value), selectedPreset: 'custom' })}
              style={{ width: '100%', cursor: 'pointer' }}
            />
            <p style={{ fontSize: '11px', color: '#94A3B8', margin: '4px 0 0' }}>
              Transactions within this delta are marked as matched with variance notes.
            </p>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                Absolute Rupee Threshold Cap
              </label>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }}>
                ₹{policy.fixedRupeeTolerance.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="250"
              step="5"
              value={policy.fixedRupeeTolerance}
              onChange={(e) => setPolicy({ ...policy, fixedRupeeTolerance: parseFloat(e.target.value), selectedPreset: 'custom' })}
              style={{ width: '100%', cursor: 'pointer' }}
            />
            <p style={{ fontSize: '11px', color: '#94A3B8', margin: '4px 0 0' }}>
              Maximum allowable monetary discrepancy regardless of percentage.
            </p>
          </div>
        </div>

        {/* Card 2: Date Slippage & AI Calibration */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>
            <Calendar size={18} style={{ color: '#16A34A' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Date Slippage & AI Outlier Calibration
            </h3>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                Settlement Date Slippage Buffer
              </label>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#16A34A' }}>
                ±{policy.dateSlippageDays} Days
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="7"
              step="1"
              value={policy.dateSlippageDays}
              onChange={(e) => setPolicy({ ...policy, dateSlippageDays: parseInt(e.target.value), selectedPreset: 'custom' })}
              style={{ width: '100%', cursor: 'pointer' }}
            />
            <p style={{ fontSize: '11px', color: '#94A3B8', margin: '4px 0 0' }}>
              Accounts for banking holidays, RTGS/NEFT batches, and ACH weekend float.
            </p>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                IsolationForest Outlier Trigger Score
              </label>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#DC2626' }}>
                {(policy.isolationForestOutlierThreshold * 100).toFixed(0)}% Risk
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="0.95"
              step="0.05"
              value={policy.isolationForestOutlierThreshold}
              onChange={(e) => setPolicy({ ...policy, isolationForestOutlierThreshold: parseFloat(e.target.value), selectedPreset: 'custom' })}
              style={{ width: '100%', cursor: 'pointer' }}
            />
            <p style={{ fontSize: '11px', color: '#94A3B8', margin: '4px 0 0' }}>
              Transactions exceeding this risk threshold trigger automatic red outlier badges.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
