import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { ImportBatchSummary } from '../../types';
import { StatusBadge } from '../../components/Badge';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  History,
  ArrowRight,
  Download,
} from 'lucide-react';
import { SpotlightCard } from '../../components/reactbits/SpotlightCard';
import { AnimatedCounter } from '../../components/reactbits/AnimatedCounter';
import { DecryptedText } from '../../components/reactbits/DecryptedText';
import { ShinyText } from '../../components/reactbits/ShinyText';
import { BorderBeam } from '../../components/reactbits/BorderBeam';

export const ImportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'upload' | 'history'>('upload');

  // Upload state
  const [sourceType, setSourceType] = useState<'INTERNAL' | 'EXTERNAL'>('INTERNAL');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [preflight, setPreflight] = useState<{
    verified: boolean;
    rowCount: number;
    headers: string[];
    previewRows: string[][];
    missingFields: string[];
  } | null>(null);

  // History state
  const [batches, setBatches] = useState<ImportBatchSummary[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const navigate = useNavigate();

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      setHistoryError(null);
      const res = await api.getImportBatches({ page: 1, pageSize: 20 });
      setBatches(res.items);
    } catch (err: any) {
      setHistoryError(err?.message || 'Failed to load import batches.');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.endsWith('.csv')) {
        setUploadError('Only CSV files are supported.');
        setSelectedFile(null);
        setPreflight(null);
        return;
      }
      setSelectedFile(file);
      setUploadError(null);

      // Perform client-side pre-flight schema inspection
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = (event.target?.result as string) || '';
          const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
          if (lines.length > 0) {
            const headerLine = lines[0].toLowerCase();
            const headers = headerLine.split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
            const required = ['transaction_reference', 'transaction_date', 'amount', 'currency'];
            const missing = required.filter((r) => !headers.some((h) => h.includes(r)));

            const preview = lines.slice(1, 4).map((line) =>
              line.split(',').map((cell) => cell.trim().replace(/^["']|["']$/g, ''))
            );

            setPreflight({
              verified: missing.length === 0,
              rowCount: lines.length - 1,
              headers,
              previewRows: preview,
              missingFields: missing,
            });
          }
        } catch {
          setPreflight(null);
        }
      };
      reader.readAsText(file.slice(0, 32768)); // read first 32KB for instant response
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError('Please select a CSV file to upload.');
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);
      const batch = await api.uploadImport(selectedFile, sourceType);
      // Navigate to validation page for this batch
      navigate(`/imports/${batch.id}/validation`);
    } catch (err: any) {
      setUploadError(err?.message || 'Upload failed. Please check file format.');
    } finally {
      setUploading(false);
    }
  };

  const downloadSampleCsv = (type: 'INTERNAL' | 'EXTERNAL') => {
    let content = '';
    let filename = '';
    if (type === 'INTERNAL') {
      content = 'transaction_reference,transaction_date,amount,currency,transaction_type,external_reference\n' +
                'TX-INT-1001,2026-11-01,1500.00,USD,LOAN_REPAYMENT,EXT-REF-1001\n' +
                'TX-INT-1002,2026-11-01,250.50,USD,INTEREST_PAYMENT,EXT-REF-1002\n' +
                'TX-INT-1003,2026-11-02,5000.00,USD,PRINCIPAL_REPAYMENT,EXT-REF-1003';
      filename = 'internal_transactions_sample.csv';
    } else {
      content = 'transaction_reference,transaction_date,amount,currency,transaction_type,external_reference\n' +
                'BANK-SETTL-1001,2026-11-01,1500.00,USD,BANK_SETTLEMENT,EXT-REF-1001\n' +
                'BANK-SETTL-1002,2026-11-01,250.50,USD,BANK_SETTLEMENT,EXT-REF-1002\n' +
                'BANK-SETTL-1003,2026-11-03,5000.00,USD,BANK_SETTLEMENT,EXT-REF-1003';
      filename = 'external_settlements_sample.csv';
    }

    const blob = new Blob([content], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '2px' }}>
        <button
          className="btn"
          onClick={() => setActiveTab('upload')}
          style={{
            borderBottom: activeTab === 'upload' ? '2px solid var(--primary)' : 'none',
            borderRadius: '0',
            color: activeTab === 'upload' ? 'var(--primary)' : '#64748B',
            fontWeight: activeTab === 'upload' ? 600 : 500,
            backgroundColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <UploadCloud size={18} />
          <span>Import CSV Data (S07)</span>
        </button>

        <button
          className="btn"
          onClick={() => setActiveTab('history')}
          style={{
            borderBottom: activeTab === 'history' ? '2px solid var(--primary)' : 'none',
            borderRadius: '0',
            color: activeTab === 'history' ? 'var(--primary)' : '#64748B',
            fontWeight: activeTab === 'history' ? 600 : 500,
            backgroundColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <History size={18} />
          <span>Batch History (S08)</span>
        </button>
      </div>

      {/* Upload View (S07) */}
      {activeTab === 'upload' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Astryx 4-Stage Ingestion Pipeline Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', padding: '14px 18px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: '#fff', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#1E293B' }}>File Ingestion</div>
                <div style={{ fontSize: '10px', color: '#64748B' }}>CSV UTF-8 Stream</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#E2E8F0', color: '#475569', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>2</div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#1E293B' }}>Schema & Types</div>
                <div style={{ fontSize: '10px', color: '#64748B' }}>Date / Decimal Check</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#E2E8F0', color: '#475569', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>3</div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#1E293B' }}>Deduplication</div>
                <div style={{ fontSize: '10px', color: '#64748B' }}>SHA-256 Hash Lock</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#E2E8F0', color: '#475569', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>4</div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#1E293B' }}>Stage For Reconcile</div>
                <div style={{ fontSize: '10px', color: '#64748B' }}>Atomic Ledger Commit</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '24px' }}>
            <div className="card" style={{ padding: '28px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Upload Transaction Batch</span>
                <ShinyText text="Enterprise Pipeline" speed={4} />
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 24px' }}>
                Upload CSV file containing lending repayment records or bank settlement statements.
              </p>

              {uploadError && (
                <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '12px', borderRadius: '8px', fontSize: '13px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={16} />
                  <span>{uploadError}</span>
                </div>
              )}

              <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '8px' }}>
                    Select Data Source Type
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <label
                      style={{
                        border: sourceType === 'INTERNAL' ? '2px solid var(--primary)' : '1px solid var(--border)',
                        backgroundColor: sourceType === 'INTERNAL' ? 'rgba(37, 99, 235, 0.04)' : '#FFFFFF',
                        borderRadius: '8px',
                        padding: '14px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      <input
                        type="radio"
                        name="sourceType"
                        value="INTERNAL"
                        checked={sourceType === 'INTERNAL'}
                        onChange={() => setSourceType('INTERNAL')}
                        style={{ display: 'none' }}
                      />
                      <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-main)' }}>Internal Ledger</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Core loan system repayments</span>
                    </label>

                    <label
                      style={{
                        border: sourceType === 'EXTERNAL' ? '2px solid var(--primary)' : '1px solid var(--border)',
                        backgroundColor: sourceType === 'EXTERNAL' ? 'rgba(37, 99, 235, 0.04)' : '#FFFFFF',
                        borderRadius: '8px',
                        padding: '14px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      <input
                        type="radio"
                        name="sourceType"
                        value="EXTERNAL"
                        checked={sourceType === 'EXTERNAL'}
                        onChange={() => setSourceType('EXTERNAL')}
                        style={{ display: 'none' }}
                      />
                      <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-main)' }}>External Settlement</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Bank statements / gateway feeds</span>
                    </label>
                  </div>
                </div>

                {/* Drag & drop upload area with React Bits BorderBeam */}
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '8px' }}>
                    Transaction CSV File
                  </label>
                  <div
                    style={{
                      border: '2px dashed #93C5FD',
                      borderRadius: '12px',
                      padding: '36px 20px',
                      textAlign: 'center',
                      backgroundColor: '#F8FAFC',
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                    onClick={() => document.getElementById('csvFileInput')?.click()}
                  >
                    <BorderBeam size={220} duration={8} colorFrom="#2563EB" colorTo="#38BDF8" borderWidth={2} />
                    <input
                      id="csvFileInput"
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                    />
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#EFF6FF', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                      <UploadCloud size={24} />
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                      {selectedFile ? selectedFile.name : 'Click to browse or drag and drop CSV'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>
                      {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'Maximum file size 25MB • Strict CSV UTF-8'}
                    </div>
                  </div>

                  {/* Pre-Flight Client-Side Schema Inspector */}
                  {preflight && (
                    <div
                      style={{
                        marginTop: '12px',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        backgroundColor: preflight.verified ? '#F0FDF4' : '#FEF2F2',
                        border: preflight.verified ? '1px solid #BBF7D0' : '1px solid #FECACA',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {preflight.verified ? (
                            <CheckCircle2 size={16} style={{ color: '#16A34A' }} />
                          ) : (
                            <AlertCircle size={16} style={{ color: '#DC2626' }} />
                          )}
                          <span style={{ fontSize: '13px', fontWeight: 700, color: preflight.verified ? '#15803D' : '#DC2626' }}>
                            {preflight.verified
                              ? 'Pre-Flight Schema Verified • Ready for Ingestion'
                              : `Missing Required Headers: ${preflight.missingFields.join(', ')}`}
                          </span>
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>
                          ~{preflight.rowCount} rows detected
                        </span>
                      </div>

                      {preflight.previewRows.length > 0 && (
                        <div style={{ overflowX: 'auto', maxHeight: '100px', backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #E2E8F0', padding: '6px' }}>
                          <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', color: '#475569' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#1E293B', fontWeight: 600 }}>
                                {preflight.headers.slice(0, 5).map((h, i) => (
                                  <th key={i} style={{ padding: '3px 6px', textAlign: 'left' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {preflight.previewRows.map((row, rIdx) => (
                                <tr key={rIdx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                  {row.slice(0, 5).map((cell, cIdx) => (
                                    <td key={cIdx} style={{ padding: '3px 6px', fontFamily: 'monospace' }}>{cell}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!selectedFile || uploading}
                  style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '12px' }}
                >
                  {uploading ? 'Uploading & Parsing Validation Rules...' : (
                    <>
                      <span>Upload and Validate Batch</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            </div>

          {/* Guidelines & sample downloads */}
          <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 6px' }}>
                CSV Format Standards
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                Files must include a header row with the following column specifications:
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
              <div style={{ padding: '8px 12px', backgroundColor: '#F8FAFC', borderRadius: '6px' }}>
                <strong style={{ color: 'var(--primary)' }}>transaction_reference</strong>: Unique batch reference string
              </div>
              <div style={{ padding: '8px 12px', backgroundColor: '#F8FAFC', borderRadius: '6px' }}>
                <strong style={{ color: 'var(--primary)' }}>transaction_date</strong>: ISO-8601 YYYY-MM-DD
              </div>
              <div style={{ padding: '8px 12px', backgroundColor: '#F8FAFC', borderRadius: '6px' }}>
                <strong style={{ color: 'var(--primary)' }}>amount</strong>: Decimal number (e.g. 1500.00)
              </div>
              <div style={{ padding: '8px 12px', backgroundColor: '#F8FAFC', borderRadius: '6px' }}>
                <strong style={{ color: 'var(--primary)' }}>currency</strong>: 3-letter ISO code (e.g. USD)
              </div>
              <div style={{ padding: '8px 12px', backgroundColor: '#F8FAFC', borderRadius: '6px' }}>
                <strong style={{ color: 'var(--primary)' }}>external_reference</strong>: Bank identifier or loan ID
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '10px' }}>
                Download Starter Templates
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => downloadSampleCsv('INTERNAL')}
                  style={{ fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <span>Internal Lending Template</span>
                  <Download size={14} />
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => downloadSampleCsv('EXTERNAL')}
                  style={{ fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <span>External Settlement Template</span>
                  <Download size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* History View (S08) */}
      {activeTab === 'history' && (
        <div className="card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
              Batch Import History
            </h3>
            <button className="btn btn-secondary" onClick={loadHistory} style={{ fontSize: '12px' }}>
              Refresh Batches
            </button>
          </div>

          {loadingHistory ? (
            <div style={{ padding: '20px' }}>
              <LoadingSkeleton rows={6} height="40px" />
            </div>
          ) : historyError ? (
            <div style={{ padding: '20px', color: '#DC2626' }}>{historyError}</div>
          ) : batches.length === 0 ? (
            <EmptyState
              icon={FileSpreadsheet}
              title="No Import Batches Yet"
              description="Upload your first internal or external CSV batch using the upload tab."
              actionText="Switch to Upload"
              onAction={() => setActiveTab('upload')}
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Batch Reference</th>
                    <th>Source</th>
                    <th>File Name</th>
                    <th>Total Rows</th>
                    <th>Valid</th>
                    <th>Rejected</th>
                    <th>Duplicates</th>
                    <th>Status</th>
                    <th>Uploaded</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr
                      key={b.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/imports/${b.id}/validation`)}
                    >
                      <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary)' }}>
                        <DecryptedText text={b.batchReference} speed={25} />
                      </td>
                      <td>
                        <StatusBadge status={b.sourceType} size="sm" />
                      </td>
                      <td style={{ fontSize: '13px' }}>{b.fileName}</td>
                      <td style={{ fontWeight: 600 }}>
                        <AnimatedCounter end={b.totalRows} />
                      </td>
                      <td style={{ color: '#16A34A', fontWeight: 600 }}>
                        <AnimatedCounter end={b.validRows} />
                      </td>
                      <td style={{ color: b.rejectedRows > 0 ? '#DC2626' : '#64748B', fontWeight: 600 }}>
                        <AnimatedCounter end={b.rejectedRows} />
                      </td>
                      <td style={{ color: b.duplicateRows > 0 ? '#D97706' : '#64748B', fontWeight: 600 }}>
                        <AnimatedCounter end={b.duplicateRows} />
                      </td>
                      <td>
                        <StatusBadge status={b.status} size="sm" />
                      </td>
                      <td style={{ fontSize: '12px', color: '#64748B' }}>
                        {new Date(b.createdAt).toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: '12px', padding: '4px 10px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/imports/${b.id}/validation`);
                          }}
                        >
                          {b.status === 'VALIDATION_COMPLETED' || b.status === 'VALIDATED' ? 'Review & Confirm' : 'View Details'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
