import React from 'react';
import { TransactionSummary } from '../types';
import { StatusBadge } from './Badge';
import { SpotlightCard } from './reactbits/SpotlightCard';
import { DecryptedText } from './reactbits/DecryptedText';
import { ShinyText } from './reactbits/ShinyText';
import { ArrowLeftRight, AlertCircle, CheckCircle2, Calendar, FileText, ArrowRight } from 'lucide-react';

interface LedgerDiffVisualizerProps {
  internalTx?: TransactionSummary | null;
  externalTx?: TransactionSummary | null;
  currency: string;
  exceptionType: string;
  discrepancyAmount?: number | null;
}

export const LedgerDiffVisualizer: React.FC<LedgerDiffVisualizerProps> = ({
  internalTx,
  externalTx,
  currency,
  exceptionType,
  discrepancyAmount,
}) => {
  // Compute Amount Delta
  const intAmt = internalTx ? Number(internalTx.amount) : null;
  const extAmt = externalTx ? Number(externalTx.amount) : null;
  const hasBoth = intAmt !== null && extAmt !== null;
  const rawDelta = hasBoth ? Math.abs(intAmt - extAmt) : (discrepancyAmount ?? 0);
  const isAmountMatch = hasBoth && Math.abs(intAmt - extAmt) < 0.001;

  // Compute Date Slippage
  let dateSlippageDays: number | null = null;
  if (internalTx && externalTx) {
    const d1 = new Date(internalTx.transactionDate).getTime();
    const d2 = new Date(externalTx.transactionDate).getTime();
    dateSlippageDays = Math.round(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24));
  }

  return (
    <SpotlightCard
      spotlightColor="rgba(37, 99, 235, 0.09)"
      style={{
        padding: '24px',
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid var(--border)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border)',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ArrowLeftRight size={18} style={{ color: 'var(--primary)' }} />
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
            Side-by-Side Ledger Diff Visualizer
          </h3>
          <span style={{ fontSize: '11px', fontFamily: 'monospace', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#EFF6FF', color: 'var(--primary)', fontWeight: 600 }}>
            {exceptionType}
          </span>
        </div>
        <div>
          <ShinyText text="Astryx Dual-Ledger Alignment" speed={3.5} />
        </div>
      </div>

      {/* 3-Column Diff Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) auto minmax(280px, 1fr)', gap: '16px', alignItems: 'stretch' }}>
        
        {/* Left Column: Internal Core Ledger */}
        <div
          style={{
            padding: '18px',
            backgroundColor: '#F8FAFC',
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
            borderLeft: '4px solid var(--primary)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Internal Core Ledger
              </span>
              <StatusBadge status="INTERNAL" size="sm" />
            </div>

            {internalTx ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '2px' }}>
                    TRANSACTION REFERENCE
                  </span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '14px', color: '#1E293B' }}>
                    <DecryptedText text={internalTx.transactionReference} speed={25} />
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '2px' }}>
                    LEDGER AMOUNT
                  </span>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', fontFamily: 'monospace' }}>
                    {internalTx.currency} {Number(internalTx.amount).toFixed(2)}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', paddingTop: '8px', borderTop: '1px solid #E2E8F0' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748B', display: 'block' }}>RECORD DATE</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                      {new Date(internalTx.transactionDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748B', display: 'block' }}>TYPE</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                      {internalTx.transactionType || 'LOAN_REPAYMENT'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '24px 12px', textAlign: 'center', color: '#DC2626', backgroundColor: '#FEF2F2', borderRadius: '8px', border: '1px dashed #FECACA' }}>
                <AlertCircle size={24} style={{ margin: '0 auto 8px', color: '#DC2626' }} />
                <div style={{ fontSize: '13px', fontWeight: 600 }}>Missing Internal Transaction</div>
                <div style={{ fontSize: '11px', color: '#991B1B', marginTop: '4px' }}>
                  No core loan repayment record linked to this external settlement.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Middle Column: Calculated Delta & Slippage Indicator */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '12px 16px',
            backgroundColor: '#F1F5F9',
            borderRadius: '10px',
            minWidth: '160px',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>
              AMOUNT VARIANCE
            </span>
            <div
              style={{
                fontSize: '16px',
                fontWeight: 800,
                color: isAmountMatch ? '#16A34A' : '#DC2626',
                fontFamily: 'monospace',
                marginTop: '2px',
              }}
            >
              {isAmountMatch ? (
                '0.00 (MATCH)'
              ) : (
                `Δ ${currency} ${Number(rawDelta).toFixed(2)}`
              )}
            </div>
          </div>

          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: isAmountMatch ? '#DCFCE7' : '#FEE2E2',
              color: isAmountMatch ? '#16A34A' : '#DC2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isAmountMatch ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          </div>

          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>
              DATE SLIPPAGE
            </span>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: dateSlippageDays === 0 ? '#16A34A' : dateSlippageDays && dateSlippageDays > 2 ? '#D97706' : '#475569',
              }}
            >
              {dateSlippageDays !== null
                ? dateSlippageDays === 0
                  ? 'Same Day (0d)'
                  : `+${dateSlippageDays} Day${dateSlippageDays > 1 ? 's' : ''}`
                : 'N/A'}
            </span>
          </div>
        </div>

        {/* Right Column: External Bank Settlement */}
        <div
          style={{
            padding: '18px',
            backgroundColor: '#F8FAFC',
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
            borderLeft: '4px solid #64748B',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                External Settlement
              </span>
              <StatusBadge status="EXTERNAL" size="sm" />
            </div>

            {externalTx ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '2px' }}>
                    SETTLEMENT REFERENCE
                  </span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '14px', color: '#1E293B' }}>
                    <DecryptedText text={externalTx.transactionReference} speed={25} />
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '2px' }}>
                    RECEIVED AMOUNT
                  </span>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', fontFamily: 'monospace' }}>
                    {externalTx.currency} {Number(externalTx.amount).toFixed(2)}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', paddingTop: '8px', borderTop: '1px solid #E2E8F0' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748B', display: 'block' }}>SETTLEMENT DATE</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                      {new Date(externalTx.transactionDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748B', display: 'block' }}>EXT REF</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155', fontFamily: 'monospace' }}>
                      {externalTx.externalReference || '—'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '24px 12px', textAlign: 'center', color: '#DC2626', backgroundColor: '#FEF2F2', borderRadius: '8px', border: '1px dashed #FECACA' }}>
                <AlertCircle size={24} style={{ margin: '0 auto 8px', color: '#DC2626' }} />
                <div style={{ fontSize: '13px', fontWeight: 600 }}>Missing External Settlement</div>
                <div style={{ fontSize: '11px', color: '#991B1B', marginTop: '4px' }}>
                  No matching bank counterparty settlement record found.
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </SpotlightCard>
  );
};
