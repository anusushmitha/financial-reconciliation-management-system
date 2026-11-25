import React from 'react';

export interface FeatureAttributionItem {
  feature: string;
  contributionPct: number;
  rawMetric: string;
  impactDirection: string;
}

export interface FeatureAttributionBarProps {
  attributions: FeatureAttributionItem[];
}

const COLORS = [
  { bar: '#DC2626', bg: '#FEE2E2', text: '#991B1B' }, // Red (Discrepancy)
  { bar: '#EA580C', bg: '#FFEDD5', text: '#9A3412' }, // Orange (Relative Variance)
  { bar: '#2563EB', bg: '#DBEAFE', text: '#1E40AF' }, // Blue (Date Drift)
  { bar: '#7C3AED', bg: '#EDE9FE', text: '#6D28D9' }, // Purple (Counterparty)
];

export const FeatureAttributionBar: React.FC<FeatureAttributionBarProps> = ({ attributions }) => {
  if (!attributions || attributions.length === 0) return null;

  return (
    <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #F1F5F9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Explainable AI Feature Attribution (SHAP-Calibrated Breakdown)
        </span>
        <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>
          Regulatory Explainability Compliant
        </span>
      </div>

      {/* Multi-segment stacked contribution bar */}
      <div
        style={{
          width: '100%',
          height: '10px',
          borderRadius: '5px',
          backgroundColor: '#E2E8F0',
          display: 'flex',
          overflow: 'hidden',
          marginBottom: '10px',
        }}
      >
        {attributions.map((attr, idx) => {
          if (attr.contributionPct <= 0) return null;
          const color = COLORS[idx % COLORS.length];
          return (
            <div
              key={idx}
              title={`${attr.feature}: ${attr.contributionPct}% (${attr.rawMetric})`}
              style={{
                width: `${attr.contributionPct}%`,
                height: '100%',
                backgroundColor: color.bar,
                transition: 'width 0.6s ease',
              }}
            />
          );
        })}
      </div>

      {/* Attribution Legend Chips */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '8px' }}>
        {attributions.map((attr, idx) => {
          const color = COLORS[idx % COLORS.length];
          return (
            <div
              key={idx}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                backgroundColor: color.bg,
                border: `1px solid ${color.bar}33`,
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: color.text }}>
                  {attr.feature}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 800, color: color.bar }}>
                  +{attr.contributionPct}%
                </span>
              </div>
              <div style={{ fontSize: '10px', color: '#64748B', fontFamily: 'monospace' }}>
                {attr.rawMetric}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
