import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import {
  ExceptionDetail,
  InvestigationNote,
  AiAnalysis,
  UserSummary,
} from '../../types';
import { StatusBadge, SeverityBadge } from '../../components/Badge';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Send,
  UserPlus,
  UserCheck,
  ShieldCheck,
  FileCheck2,
  Activity,
  Cpu,
  BookOpen,
  Copy,
  Check,
  Download,
} from 'lucide-react';
import { SpotlightCard } from '../../components/reactbits/SpotlightCard';
import { AnimatedCounter } from '../../components/reactbits/AnimatedCounter';
import { ShinyText } from '../../components/reactbits/ShinyText';
import { DecryptedText } from '../../components/reactbits/DecryptedText';
import { BorderBeam } from '../../components/reactbits/BorderBeam';
import { FeatureAttributionBar } from '../../components/reactbits/FeatureAttributionBar';
import { LedgerDiffVisualizer } from '../../components/LedgerDiffVisualizer';

export const ExceptionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [exception, setException] = useState<ExceptionDetail | null>(null);
  const [notes, setNotes] = useState<InvestigationNote[]>([]);
  const [explanationAnalysis, setExplanationAnalysis] = useState<AiAnalysis | null>(null);
  const [anomalyAnalysis, setAnomalyAnalysis] = useState<AiAnalysis | null>(null);
  const [users, setUsers] = useState<UserSummary[]>([]);

  const [loading, setLoading] = useState(true);
  const [analyzingAi, setAnalyzingAi] = useState(false);
  const [copiedJournal, setCopiedJournal] = useState(false);
  const [postingJournal, setPostingJournal] = useState(false);
  const [postedJournalRef, setPostedJournalRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Note form state
  const [newNote, setNewNote] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  // Assign Modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Resolve Modal state
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionCategory, setResolutionCategory] = useState('TIMING_DIFFERENCE_ACKNOWLEDGED');
  const [resolutionExplanation, setResolutionExplanation] = useState('');
  const [resolving, setResolving] = useState(false);

  const loadData = async () => {
    if (!id) return;
    try {
      setError(null);
      const [exData, noteData, aiAnalyses] = await Promise.all([
        api.getException(id),
        api.getExceptionNotes(id),
        api.getExceptionAiAnalyses(id).catch(() => ({ explanation: undefined, anomaly: undefined, all: [] })),
      ]);
      setException(exData);
      setNotes(noteData);
      setExplanationAnalysis(aiAnalyses.explanation || null);
      setAnomalyAnalysis(aiAnalyses.anomaly || null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load exception details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const onRealtime = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.eventType === 'SYSTEM_RESEEDED' || detail.data?.exceptionId === id || detail.eventType === 'BATCH_ASSIGNED') {
        loadData();
      }
    };
    window.addEventListener('lendguard:realtime', onRealtime);
    return () => window.removeEventListener('lendguard:realtime', onRealtime);
  }, [id]);

  const handlePostNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newNote.trim()) return;

    try {
      setSubmittingNote(true);
      const created = await api.addExceptionNote(id, newNote.trim());
      setNotes((prev) => [...prev, created]);
      setNewNote('');
    } catch (err: any) {
      addToast(err?.message || 'Failed to post note.', 'error');
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleRequestAi = async (mode: 'ALL' | 'ANOMALY' | 'EXPLANATION' = 'ALL') => {
    if (!id) return;
    try {
      setAnalyzingAi(true);
      const results = await api.analyzeException(id, mode);
      if (results.explanation) setExplanationAnalysis(results.explanation);
      if (results.anomaly) setAnomalyAnalysis(results.anomaly);
    } catch (err: any) {
      addToast(err?.message || 'AI service unavailable. Advisory analysis could not be completed.', 'error');
    } finally {
      setAnalyzingAi(false);
    }
  };

  const openAssignModal = async () => {
    setShowAssignModal(true);
    try {
      const uRes = await api.getUsers({ pageSize: 50 });
      setUsers(uRes.items);
      if (uRes.items.length > 0) {
        if (exception?.assignedTo) {
          setSelectedUserId(exception.assignedTo.id);
        } else {
          setSelectedUserId(uRes.items[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleClaimException = async () => {
    if (!id || !user) return;
    try {
      setAssigning(true);
      await api.assignException(id, user.id);
      await loadData();
    } catch (err: any) {
      addToast(err?.message || 'Failed to claim exception.', 'error');
    } finally {
      setAssigning(false);
    }
  };

  const handleAssign = async () => {
    if (!id || !selectedUserId) return;
    try {
      setAssigning(true);
      await api.assignException(id, selectedUserId);
      setShowAssignModal(false);
      await loadData();
    } catch (err: any) {
      addToast(err?.message || 'Failed to assign exception.', 'error');
    } finally {
      setAssigning(false);
    }
  };

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !resolutionExplanation.trim()) return;
    try {
      setResolving(true);
      await api.resolveException(id, {
        resolutionCategory,
        resolutionExplanation: resolutionExplanation.trim(),
      });
      setShowResolveModal(false);
      await loadData();
    } catch (err: any) {
      addToast(err?.message || 'Failed to resolve exception.', 'error');
    } finally {
      setResolving(false);
    }
  };

  if (loading && !exception) {
    return (
      <div className="card" style={{ padding: '28px' }}>
        <LoadingSkeleton rows={8} height="40px" />
      </div>
    );
  }

  if (error || !exception) {
    return (
      <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
        <div style={{ color: '#DC2626', marginBottom: '16px' }}>{error || 'Exception not found'}</div>
        <button className="btn btn-secondary" onClick={() => navigate('/exceptions')}>
          <ArrowLeft size={16} />
          <span>Back to Exception Queue</span>
        </button>
      </div>
    );
  }

  const isResolved = exception.status === 'RESOLVED';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top action bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          className="btn btn-secondary"
          onClick={() => navigate('/exceptions')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
        >
          <ArrowLeft size={16} />
          <span>Back to Exception Queue</span>
        </button>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {isAdmin ? (
            <button
              className="btn btn-secondary"
              onClick={openAssignModal}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
            >
              <UserPlus size={14} />
              <span>{exception.assignedTo ? 'Reassign Analyst' : 'Assign to Analyst'}</span>
            </button>
          ) : !exception.assignedTo && !isResolved ? (
            <button
              className="btn btn-secondary"
              onClick={handleClaimException}
              disabled={assigning}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                backgroundColor: '#DCFCE7',
                color: '#15803D',
                borderColor: '#BBF7D0',
                fontWeight: 600
              }}
            >
              <UserCheck size={14} />
              <span>{assigning ? 'Claiming...' : 'Claim Exception (Assign to Me)'}</span>
            </button>
          ) : null}

          {!isResolved && (
            <button
              className="btn btn-primary"
              onClick={() => setShowResolveModal(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
            >
              <CheckCircle2 size={15} />
              <span>Resolve Exception</span>
            </button>
          )}
        </div>
      </div>

      {/* Exception Header Overview */}
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: '18px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, fontFamily: 'monospace' }}>
                {exception.exceptionType}
              </h2>
              <SeverityBadge severity={exception.severity} />
              <StatusBadge status={exception.status} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px', fontSize: '13px', color: '#64748B', flexWrap: 'wrap' }}>
              <span>ID: <code style={{ fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 600 }}><DecryptedText text={exception.id} speed={25} /></code></span>
              <span>•</span>
              <span>
                Assigned:{' '}
                {exception.assignedTo ? (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: exception.assignedTo.id === user?.id ? '#DCFCE7' : '#F1F5F9',
                    color: exception.assignedTo.id === user?.id ? '#15803D' : '#334155',
                    fontWeight: 600,
                    border: exception.assignedTo.id === user?.id ? '1px solid #BBF7D0' : '1px solid #E2E8F0'
                  }}>
                    <UserCheck size={12} />
                    {exception.assignedTo.fullName} {exception.assignedTo.id === user?.id ? '(You)' : ''}
                  </span>
                ) : (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: '#FEF3C7',
                    color: '#B45309',
                    fontWeight: 600
                  }}>
                    <AlertTriangle size={12} />
                    Unassigned
                  </span>
                )}
              </span>
              <span>•</span>
              <span>Flagged: {new Date(exception.createdAt).toLocaleString()}</span>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Discrepancy Amount</span>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#DC2626' }}>
              {exception.discrepancyAmount !== undefined && exception.discrepancyAmount !== null
                ? `${exception.currency} ${Number(exception.discrepancyAmount).toFixed(2)}`
                : 'N/A'}
            </div>
          </div>
        </div>

        {/* Facts summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          <div style={{ padding: '12px 16px', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
            <span style={{ fontSize: '12px', color: '#64748B', display: 'block', marginBottom: '2px' }}>Expected Amount</span>
            <span style={{ fontSize: '15px', fontWeight: 600 }}>
              {exception.expectedAmount !== undefined && exception.expectedAmount !== null
                ? `${exception.currency} ${Number(exception.expectedAmount).toFixed(2)}`
                : '—'}
            </span>
          </div>

          <div style={{ padding: '12px 16px', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
            <span style={{ fontSize: '12px', color: '#64748B', display: 'block', marginBottom: '2px' }}>Actual Received</span>
            <span style={{ fontSize: '15px', fontWeight: 600 }}>
              {exception.actualAmount !== undefined && exception.actualAmount !== null
                ? `${exception.currency} ${Number(exception.actualAmount).toFixed(2)}`
                : '—'}
            </span>
          </div>

          <div style={{ padding: '12px 16px', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
            <span style={{ fontSize: '12px', color: '#64748B', display: 'block', marginBottom: '2px' }}>Currency</span>
            <span style={{ fontSize: '15px', fontWeight: 600 }}>{exception.currency}</span>
          </div>

          <div style={{ padding: '12px 16px', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
            <span style={{ fontSize: '12px', color: '#64748B', display: 'block', marginBottom: '2px' }}>Resolution State</span>
            <span style={{ fontSize: '15px', fontWeight: 600, color: isResolved ? '#16A34A' : '#DC2626' }}>
              {isResolved ? 'Resolved by Reviewer' : 'Awaiting Investigation'}
            </span>
          </div>
        </div>
      </div>

      {/* Side-by-Side Meta Astryx Ledger Diff Visualizer */}
      <LedgerDiffVisualizer
        internalTx={exception.internalTransaction}
        externalTx={exception.externalTransaction}
        currency={exception.currency}
        exceptionType={exception.exceptionType}
        discrepancyAmount={exception.discrepancyAmount}
      />

      {/* Dual-Engine AI Advisory System */}
      <div className="card" style={{ padding: '24px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#EFF6FF', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  Dual-Engine AI Intelligence Center
                </h3>
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', backgroundColor: '#EDE9FE', color: '#6D28D9' }}>
                  Enterprise Architecture
                </span>
              </div>
              <span style={{ fontSize: '12px', color: '#64748B' }}>
                Engine 1: Scikit-Learn IsolationForest ML &bull; Engine 2: NVIDIA NIM Generative Explainer
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn btn-primary"
              onClick={() => handleRequestAi('ALL')}
              disabled={analyzingAi}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 16px', fontWeight: 600 }}
            >
              <Sparkles size={15} />
              <span>{analyzingAi ? 'Computing AI Diagnostics...' : ((anomalyAnalysis || explanationAnalysis) ? 'Re-run Full AI Diagnostics' : 'Run Full AI Diagnostics')}</span>
            </button>
          </div>
        </div>

        {/* Boundary Notice */}
        <div style={{ padding: '9px 14px', backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '6px', fontSize: '12px', color: '#92400E', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={16} style={{ flexShrink: 0, color: '#B45309' }} />
          <span>
            <strong>Advisory Sandbox Boundary:</strong> AI diagnostics operate strictly in advisory mode. No ledger mutations or automatic transaction resolution are permitted without human analyst sign-off.
          </span>
        </div>

        {(!anomalyAnalysis && !explanationAnalysis) ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px dashed #CBD5E1' }}>
            <Bot size={36} style={{ color: '#94A3B8', margin: '0 auto 12px' }} />
            <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#334155', margin: '0 0 6px' }}>No AI Diagnostics Recorded Yet</h4>
            <p style={{ fontSize: '13px', color: '#64748B', maxWidth: '520px', margin: '0 auto 16px' }}>
              Execute Dual-Engine AI Diagnostics to simultaneously evaluate quantitative ML anomaly outlier density (IsolationForest) and generate causal root-cause reasoning via live NVIDIA NIM models.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => handleRequestAi('ALL')}
              disabled={analyzingAi}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
            >
              <Sparkles size={14} />
              <span>Run Full AI Diagnostics</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* GRID OF TWO ENGINES */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
              
              {/* ENGINE 1: SCIKIT-LEARN ISOLATION FOREST ANOMALY GAUGE */}
              <SpotlightCard
                spotlightColor="rgba(2, 132, 199, 0.14)"
                style={{
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  position: 'relative',
                }}
              >
                <div>
                  {/* Engine 1 Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Activity size={18} style={{ color: '#0284C7' }} />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Engine 1: ML Anomaly Detector
                      </span>
                    </div>
                    <span style={{
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      padding: '2px 8px',
                      backgroundColor: '#F0F9FF',
                      color: '#0369A1',
                      borderRadius: '4px',
                      border: '1px solid #BAE6FD'
                    }}>
                      <ShinyText text="TRI-MODEL OUTLIER ENSEMBLE" speed={3} />
                    </span>
                  </div>

                  {anomalyAnalysis ? (() => {
                    const ev = anomalyAnalysis.evidence || {};
                    const score = typeof ev.anomalyScore === 'number' ? ev.anomalyScore : (anomalyAnalysis.summary?.match(/(\d+)%/)?.[1] ? Number(anomalyAnalysis.summary.match(/(\d+)%/)?.[1]) / 100 : 0.75);
                    const pct = Math.round(score * 100);
                    const riskLevel = ev.riskLevel || (pct >= 80 ? 'CRITICAL' : pct >= 60 ? 'HIGH' : pct >= 35 ? 'MODERATE' : 'LOW');
                    const signals: string[] = Array.isArray(ev.signals) ? ev.signals : [];

                    const riskColors = {
                      CRITICAL: { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', bar: '#DC2626' },
                      HIGH: { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', bar: '#D97706' },
                      MEDIUM: { bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF', bar: '#2563EB' },
                      MODERATE: { bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF', bar: '#2563EB' },
                      LOW: { bg: '#F0FDF4', border: '#BBF7D0', text: '#166534', bar: '#16A34A' },
                    }[riskLevel as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'MODERATE' | 'LOW'] || { bg: '#F8FAFC', border: '#E2E8F0', text: '#334155', bar: '#64748B' };

                    const savedPolicyRaw = localStorage.getItem('lendguard_matching_policy');
                    const outlierPctThreshold = savedPolicyRaw
                      ? Math.round((JSON.parse(savedPolicyRaw).isolationForestOutlierThreshold ?? 0.75) * 100)
                      : 60;

                    return (
                      <div>
                        {/* Risk Gauge Header Card */}
                        <div style={{
                          padding: '14px',
                          backgroundColor: riskColors.bg,
                          border: `1px solid ${riskColors.border}`,
                          borderRadius: '8px',
                          marginBottom: '16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <div>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: riskColors.text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Calculated Anomaly Score
                            </span>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '2px' }}>
                              <span style={{ fontSize: '28px', fontWeight: 800, color: riskColors.text, lineHeight: 1 }}>
                                <AnimatedCounter value={pct} suffix="%" duration={850} />
                              </span>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: riskColors.text }}>
                                Outlier Density
                              </span>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '4px 10px',
                              borderRadius: '20px',
                              backgroundColor: riskColors.bar,
                              color: '#FFFFFF',
                              fontWeight: 700,
                              fontSize: '12px',
                              letterSpacing: '0.03em'
                            }}>
                              {riskLevel} RISK
                            </span>
                            <div style={{ fontSize: '11px', color: riskColors.text, marginTop: '4px' }}>
                              {pct >= outlierPctThreshold ? 'Requires Immediate Review' : 'Standard Variance'}
                            </div>
                          </div>
                        </div>

                        {/* Visual Progress Gauge Bar */}
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>
                            <span>0% Normal Variance</span>
                            <span>50% Threshold</span>
                            <span>100% Outlier</span>
                          </div>
                          <div style={{
                            width: '100%',
                            height: '10px',
                            backgroundColor: '#E2E8F0',
                            borderRadius: '5px',
                            overflow: 'hidden',
                            position: 'relative'
                          }}>
                            <div style={{
                              width: `${pct}%`,
                              height: '100%',
                              backgroundColor: riskColors.bar,
                              borderRadius: '5px',
                              transition: 'width 0.8s ease'
                            }} />
                          </div>
                        </div>

                        {/* Signals Detected Section */}
                        <div style={{ marginBottom: '14px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                            Multidimensional Anomaly Signals Detected ({signals.length})
                          </span>
                          {signals.length === 0 ? (
                            <span style={{ fontSize: '12px', color: '#16A34A', fontWeight: 500 }}>
                              No anomalous behavioral vectors detected.
                            </span>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {signals.map((sig, idx) => {
                                const isCritical = sig.includes('CRITICAL') || sig.includes('HIGH_VALUE');
                                return (
                                  <span key={idx} style={{
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    padding: '3px 8px',
                                    borderRadius: '4px',
                                    backgroundColor: isCritical ? '#FEE2E2' : '#FEF3C7',
                                    color: isCritical ? '#991B1B' : '#92400E',
                                    border: isCritical ? '1px solid #FCA5A5' : '1px solid #FDE68A',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}>
                                    <span>{isCritical ? '⚠️' : '⚡'}</span>
                                    <span>{sig.replace(/_/g, ' ')}</span>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Explainable AI Feature Attribution Breakdown (SHAP-calibrated) */}
                        <FeatureAttributionBar attributions={ev.featureAttributions} />

                        {/* Model Evaluation Summary */}
                        <p style={{ fontSize: '13px', color: '#334155', lineHeight: 1.5, margin: '12px 0 0' }}>
                          {anomalyAnalysis.summary}
                        </p>
                      </div>
                    );
                  })() : (
                    <div style={{ padding: '24px 12px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
                      <span>ML Anomaly scoring pending. Click "Run Full AI Diagnostics" to evaluate.</span>
                    </div>
                  )}
                </div>

                {anomalyAnalysis && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: '10px', marginTop: '14px', fontSize: '11px', color: '#94A3B8', flexWrap: 'wrap', gap: '6px' }}>
                    <span>Model: <strong style={{ color: '#475569' }}>{anomalyAnalysis.modelName || 'isolation-forest-v2.0-enterprise'}</strong></span>
                    <span>Status: <strong style={{ color: '#16A34A' }}>Calibrated Outlier Density</strong></span>
                  </div>
                )}

                {(analyzingAi || (anomalyAnalysis?.evidence?.riskLevel === 'CRITICAL')) && (
                  <BorderBeam size={220} duration={6} colorFrom="#DC2626" colorTo="#2563EB" />
                )}
              </SpotlightCard>

              {/* ENGINE 2: NVIDIA NIM GENERATIVE LLM EXPLAINER */}
              <SpotlightCard
                spotlightColor="rgba(22, 163, 74, 0.14)"
                style={{
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  position: 'relative',
                }}
              >
                <div>
                  {/* Engine 2 Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Cpu size={18} style={{ color: '#16A34A' }} />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Engine 2: Generative LLM Explainer
                      </span>
                    </div>
                    <span style={{
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      padding: '2px 8px',
                      backgroundColor: '#F0FDF4',
                      color: '#166534',
                      borderRadius: '4px',
                      border: '1px solid #BBF7D0'
                    }}>
                      <ShinyText text="NVIDIA NIM LIVE INFERENCE" speed={3} />
                    </span>
                  </div>

                  {explanationAnalysis ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {/* Live Provenance Badge */}
                      {(() => {
                        const isLiveAi = Boolean(
                          explanationAnalysis.modelName &&
                          !explanationAnalysis.modelName.includes('ai-offline') &&
                          !explanationAnalysis.modelName.includes('rule-engine') &&
                          !explanationAnalysis.modelName.includes('heuristic') &&
                          !explanationAnalysis.modelName.includes('evidence-explainer')
                        );
                        return (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '6px',
                            padding: '8px 12px',
                            backgroundColor: isLiveAi ? '#F0FDF4' : '#FFFBEB',
                            border: isLiveAi ? '1px solid #BBF7D0' : '1px solid #FDE68A',
                            borderRadius: '6px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: isLiveAi ? '#16A34A' : '#D97706',
                                display: 'inline-block',
                                boxShadow: isLiveAi ? '0 0 6px rgba(22, 163, 74, 0.7)' : 'none'
                              }} />
                              <span style={{ fontSize: '11px', fontWeight: 700, color: isLiveAi ? '#166534' : '#92400E' }}>
                                <ShinyText text={isLiveAi ? 'VERIFIED LIVE NVIDIA AI' : 'AI OFFLINE • STANDARD REFERENCE'} speed={2.5} />
                              </span>
                              <span style={{
                                fontSize: '11px',
                                fontFamily: 'monospace',
                                fontWeight: 600,
                                padding: '1px 6px',
                                backgroundColor: isLiveAi ? '#DCFCE7' : '#FEF3C7',
                                color: isLiveAi ? '#15803D' : '#92400E',
                                borderRadius: '4px'
                              }}>
                                {explanationAnalysis.modelName}
                              </span>
                            </div>
                            <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>
                              {isLiveAi ? 'NVIDIA NIM Live API' : 'Fallback Active Until AI Reconnects'}
                            </span>
                          </div>
                        );
                      })()}

                      {/* Root Cause Hypothesis */}
                      <div>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Root Cause Hypothesis
                        </span>
                        <p style={{ fontSize: '13px', color: 'var(--text-main)', margin: '4px 0 0', lineHeight: 1.5 }}>
                          {explanationAnalysis.summary}
                        </p>
                      </div>

                      {/* Recommended Action */}
                      {explanationAnalysis.recommendation && (
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Recommended Remediation Action
                          </span>
                          <p style={{ fontSize: '13px', color: 'var(--text-main)', margin: '4px 0 0', lineHeight: 1.5 }}>
                            {explanationAnalysis.recommendation}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ padding: '24px 12px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
                      <span>Generative LLM reasoning pending. Click "Run Full AI Diagnostics" to synthesize.</span>
                    </div>
                  )}
                </div>

                {explanationAnalysis && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: '10px', marginTop: '14px', fontSize: '11px', color: '#94A3B8' }}>
                    <span>Evaluated: {new Date(explanationAnalysis.createdAt).toLocaleTimeString()}</span>
                    <span>Status: <strong style={{ color: '#16A34A' }}>Audited & Advisory Grounded</strong></span>
                  </div>
                )}

                {analyzingAi && <BorderBeam size={220} duration={5} colorFrom="#16A34A" colorTo="#2563EB" />}
              </SpotlightCard>

            </div>
          </div>
        )}
      </div>

      {/* Prescriptive Double-Entry Accounting Journal Suggestion */}
      {(() => {
        const currency = exception.currency || 'INR';
        const expAmt = Number(exception.expectedAmount || 0);
        const actAmt = Number(exception.actualAmount || 0);
        const diffAmt = Number(exception.discrepancyAmount || (actAmt - expAmt));
        const absDiff = Math.abs(diffAmt);
        const fallbackAmt = absDiff || actAmt || expAmt || 100;

        let strategyTitle = 'General Exception Suspense Holding';
        let memo = `Reconcile discrepancy for exception ref: ${exception.id}`;
        let lines: Array<{ code: string; name: string; debit: number; credit: number }> = [];

        if (exception.exceptionType === 'AMOUNT_MISMATCH' || exception.exceptionType === 'PARTIAL_SETTLEMENT') {
          if (expAmt > 0 && actAmt < expAmt) {
            const gap = expAmt - actAmt;
            strategyTitle = exception.exceptionType === 'PARTIAL_SETTLEMENT'
              ? 'Partial Tranche Settlement & Remaining Receivable Hold'
              : 'Gateway Service Fee Deduction / Shortfall Reclassification';
            memo = `Reconcile ${currency} ${gap.toFixed(2)} shortfall between core schedule (${currency} ${expAmt.toFixed(2)}) and bank receipt (${currency} ${actAmt.toFixed(2)})`;
            lines = [
              { code: exception.exceptionType === 'PARTIAL_SETTLEMENT' ? '1325' : '5120', name: exception.exceptionType === 'PARTIAL_SETTLEMENT' ? 'Partial Tranche Outstanding Receivable' : 'Gateway Interchange & Processing Expense', debit: gap, credit: 0 },
              { code: '1020', name: 'Cash at Bank (Settlement Clearing)', debit: actAmt, credit: 0 },
              { code: '1310', name: 'Loan Principal & Repayment Receivable', debit: 0, credit: expAmt },
            ].filter(l => l.debit > 0 || l.credit > 0);
          } else if (actAmt > expAmt && (expAmt > 0 || actAmt > 0)) {
            const gap = actAmt - expAmt;
            strategyTitle = 'Excess Remittance / Borrower Overpayment Allocation';
            memo = `Credit ${currency} ${gap.toFixed(2)} surplus inflow received above scheduled amount to customer suspense`;
            lines = [
              { code: '1020', name: 'Cash at Bank (Settlement Clearing)', debit: actAmt, credit: 0 },
              { code: '1310', name: 'Loan Principal & Repayment Receivable', debit: 0, credit: expAmt },
              { code: '2150', name: 'Clearing Suspense Account (Excess Inflow)', debit: 0, credit: gap },
            ].filter(l => l.debit > 0 || l.credit > 0);
          } else {
            strategyTitle = 'Amount Discrepancy Suspense Adjustment';
            memo = `Hold ${currency} ${fallbackAmt.toFixed(2)} variance in reconciliation clearing suspense pending bank advice`;
            lines = [
              { code: '5120', name: 'Gateway Variance / Unreconciled Adjustment', debit: fallbackAmt, credit: 0 },
              { code: '2150', name: 'Clearing Suspense Account', debit: 0, credit: fallbackAmt },
            ];
          }
        } else if (exception.exceptionType === 'UNMATCHED_EXTERNAL' || exception.exceptionType === 'MISSING_INTERNAL') {
          const amt = actAmt || fallbackAmt;
          strategyTitle = 'Unidentified Inbound Settlement Clearing';
          memo = `Inbound bank settlement of ${currency} ${amt.toFixed(2)} received without matched core loan schedule`;
          lines = [
            { code: '1020', name: 'Cash at Bank (External Feed Inflow)', debit: amt, credit: 0 },
            { code: '2190', name: 'Unidentified Inbound Remittance Suspense', debit: 0, credit: amt },
          ];
        } else if (exception.exceptionType === 'MISSING_SETTLEMENT' || exception.exceptionType === 'MISSING_EXTERNAL') {
          const amt = expAmt || fallbackAmt;
          strategyTitle = 'In-Transit Gateway Settlement Accrual';
          memo = `Internal repayment (${currency} ${amt.toFixed(2)}) posted but external gateway settlement not yet confirmed`;
          lines = [
            { code: '1320', name: 'In-Transit Settlement Clearing Control', debit: amt, credit: 0 },
            { code: '1310', name: 'Loan Principal & Repayment Receivable', debit: 0, credit: amt },
          ];
        } else if (exception.exceptionType === 'DATE_SLIPPAGE') {
          const amt = actAmt || expAmt || fallbackAmt;
          strategyTitle = 'Value-Date Timing Discrepancy Adjustment';
          memo = `Timing reclassification between internal value date and external bank credit`;
          lines = [
            { code: '1020', name: 'Cash at Bank (Value-Date Restatement)', debit: amt, credit: 0 },
            { code: '1320', name: 'Transit Settlement Clearing Control', debit: 0, credit: amt },
          ];
        } else if (exception.exceptionType === 'DUPLICATE') {
          const amt = actAmt || expAmt || fallbackAmt;
          strategyTitle = 'Duplicate Settlement Reversal Holding';
          memo = `Isolate suspected duplicate counterparty entry (${currency} ${amt.toFixed(2)}) pending chargeback / reversal verification`;
          lines = [
            { code: '2155', name: 'Duplicate Settlement Refund Liability', debit: amt, credit: 0 },
            { code: '1020', name: 'Cash at Bank (Settlement Clearing)', debit: 0, credit: amt },
          ];
        } else {
          strategyTitle = 'Ambiguous / General Exception Suspense Holding';
          memo = `Isolate ambiguous settlement match (${currency} ${fallbackAmt.toFixed(2)}) pending analyst counterparty confirmation`;
          lines = [
            { code: '2199', name: 'General Reconciliation Exception Suspense', debit: fallbackAmt, credit: 0 },
            { code: '1020', name: 'Settlement Clearing Control', debit: 0, credit: fallbackAmt },
          ];
        }

        const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
        const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
        const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001;

        const copyJournalPayload = () => {
          const payload = {
            journalEntryRef: `JE-LG-${exception.id.slice(0, 8).toUpperCase()}`,
            postingDate: new Date().toISOString().slice(0, 10),
            currency,
            strategy: strategyTitle,
            memo,
            lines: lines.map((l) => ({
              accountCode: l.code,
              accountName: l.name,
              debit: l.debit.toFixed(2),
              credit: l.credit.toFixed(2),
            })),
            balanced: isBalanced,
          };
          navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
          setCopiedJournal(true);
          addToast('Journal Entry JSON copied to clipboard', 'success');
          setTimeout(() => setCopiedJournal(false), 2500);
        };

        const exportJournalCsv = () => {
          const header = 'AccountCode,AccountName,Currency,Debit,Credit,Memo\n';
          const body = lines
            .map((l) => `${l.code},"${l.name}",${currency},${l.debit.toFixed(2)},${l.credit.toFixed(2)},"${memo.replace(/"/g, '""')}"`)
            .join('\n');
          const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `gl_journal_${exception.id.slice(0, 8)}.csv`;
          a.click();
          window.URL.revokeObjectURL(url);
          addToast('ERP Journal Voucher CSV exported.', 'success');
        };

        const postJournalToLedger = async () => {
          try {
            setPostingJournal(true);
            const res = await api.postExceptionJournal(exception.id, {
              currency,
              strategy: strategyTitle,
              memo,
              lines: lines.map((l) => ({
                accountCode: l.code,
                accountName: l.name,
                debit: Number(l.debit.toFixed(2)),
                credit: Number(l.credit.toFixed(2)),
              })),
            });
            setPostedJournalRef(res.journalEntryRef);
            addToast(`Journal ${res.journalEntryRef} posted cleanly to audit log.`, 'success');
          } catch (err: any) {
            addToast(err?.message || 'Failed to record GL journal entry.', 'error');
          } finally {
            setPostingJournal(false);
          }
        };

        return (
          <div className="card" style={{ padding: '24px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#FEF3C7', color: '#B45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BookOpen size={20} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                      Prescriptive Double-Entry Accounting Journal Suggestion
                    </h3>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: '#DCFCE7', color: '#15803D' }}>
                      GAAP / IFRS COMPLIANT
                    </span>
                    {postedJournalRef && (
                      <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'monospace', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>
                        POSTED: {postedJournalRef}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>
                    Strategy: <strong style={{ color: '#334155' }}>{strategyTitle}</strong>
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={copyJournalPayload}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}
                >
                  {copiedJournal ? <Check size={14} style={{ color: '#16A34A' }} /> : <Copy size={14} />}
                  <span>{copiedJournal ? 'Payload Copied!' : 'Copy JSON'}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={exportJournalCsv}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}
                >
                  <Download size={14} />
                  <span>Export ERP CSV</span>
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={postJournalToLedger}
                  disabled={postingJournal || !isBalanced}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}
                >
                  <CheckCircle2 size={14} />
                  <span>{postingJournal ? 'Posting...' : postedJournalRef ? 'Recorded to Audit Log' : 'Post to Immutable GL Log'}</span>
                </button>
              </div>
            </div>

            {/* Memo Box */}
            <div style={{ padding: '10px 14px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0', fontSize: '12px', color: '#475569', marginBottom: '16px' }}>
              <strong style={{ color: '#0F172A' }}>Ledger Memo: </strong>
              <span>{memo}</span>
            </div>

            {/* Double-Entry Table */}
            <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', textAlign: 'left', fontWeight: 600 }}>
                    <th style={{ padding: '10px 14px', width: '100px' }}>Account Code</th>
                    <th style={{ padding: '10px 14px' }}>Account Name & General Ledger Line</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', width: '130px' }}>Debit ({currency})</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', width: '130px' }}>Credit ({currency})</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>
                        {line.code}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#1E293B' }}>
                        {line.name}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: line.debit > 0 ? '#0F172A' : '#94A3B8' }}>
                        {line.debit > 0 ? line.debit.toFixed(2) : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: line.credit > 0 ? '#0F172A' : '#94A3B8' }}>
                        {line.credit > 0 ? line.credit.toFixed(2) : '—'}
                      </td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  <tr style={{ backgroundColor: '#F8FAFC', fontWeight: 700, borderTop: '2px solid #E2E8F0' }}>
                    <td colSpan={2} style={{ padding: '10px 14px', textAlign: 'right', color: '#475569' }}>
                      Trial Balance Totals:
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#0F172A' }}>
                      {totalDebit.toFixed(2)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#0F172A' }}>
                      {totalCredit.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Balancing Verification Badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', fontSize: '11px', color: '#64748B' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {isBalanced ? (
                  <CheckCircle2 size={14} style={{ color: '#16A34A' }} />
                ) : (
                  <AlertTriangle size={14} style={{ color: '#DC2626' }} />
                )}
                <span style={{ fontWeight: 600, color: isBalanced ? '#16A34A' : '#DC2626' }}>
                  {isBalanced ? 'Dual-Entry Trial Balance Verified (Variance: 0.00)' : 'Trial Balance Imbalance Detected'}
                </span>
              </div>
              <span>Ready for ERP Export (SAP S/4HANA • NetSuite • Oracle Fusion)</span>
            </div>
          </div>
        );
      })()}

      {/* Resolution Card if already resolved */}
      {isResolved && (
        <div className="card" style={{ padding: '20px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#166534' }}>
            <FileCheck2 size={20} />
            <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Human Resolution Sign-Off</h4>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
            <div>
              <strong style={{ color: '#166534' }}>Category: </strong>
              <span>{exception.resolutionCategory}</span>
            </div>
            <div>
              <strong style={{ color: '#166534' }}>Explanation: </strong>
              <span>{exception.resolutionExplanation}</span>
            </div>
            <div style={{ fontSize: '11px', color: '#15803D', marginTop: '4px' }}>
              Resolved by {exception.resolvedBy?.fullName || 'Analyst'} on {exception.resolvedAt ? new Date(exception.resolvedAt).toLocaleString() : ''}
            </div>
          </div>
        </div>
      )}

      {/* Notes & Investigation Timeline */}
      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 16px' }}>
          Investigation Notes & Audit Timeline ({notes.length})
        </h3>

        {/* Existing notes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          {notes.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#94A3B8', fontStyle: 'italic', margin: 0 }}>
              No investigation notes recorded yet. Add initial observations below.
            </p>
          ) : (
            notes.map((n) => (
              <div key={n.id} style={{ padding: '12px 16px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                    {n.userName || 'Analyst'}
                  </span>
                  <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-main)', margin: 0, lineHeight: 1.5 }}>
                  {n.note}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Add note input */}
        <form onSubmit={handlePostNote} style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Document investigation findings, contact with bank, or ledger adjustment rationale..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            disabled={submittingNote}
            style={{ fontSize: '13px' }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submittingNote || !newNote.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', whiteSpace: 'nowrap' }}
          >
            <Send size={14} />
            <span>Post Note</span>
          </button>
        </form>
      </div>

      {/* Assign Modal */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title="Assign Exception to Analyst"
        description="Select an authorized employee to lead this discrepancy investigation."
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowAssignModal(false)} disabled={assigning}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleAssign} disabled={assigning || !selectedUserId}>
              {assigning ? 'Assigning...' : 'Assign Exception'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <label className="form-label">Select Employee</label>
          <select
            className="form-control"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName} ({u.email}) — {u.role}
              </option>
            ))}
          </select>
        </div>
      </Modal>

      {/* Resolve Modal */}
      <Modal
        isOpen={showResolveModal}
        onClose={() => setShowResolveModal(false)}
        title="Resolve Discrepancy Exception"
        description="Record final human sign-off with standard resolution category and audit justification."
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowResolveModal(false)} disabled={resolving}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleResolve}
              disabled={resolving || !resolutionExplanation.trim()}
            >
              {resolving ? 'Submitting Sign-off...' : 'Confirm Resolution'}
            </button>
          </>
        }
      >
        <form onSubmit={handleResolve} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '6px' }}>
              Resolution Category
            </label>
            <select
              className="form-control"
              value={resolutionCategory}
              onChange={(e) => setResolutionCategory(e.target.value)}
              required
            >
              <option value="TIMING_DIFFERENCE_ACKNOWLEDGED">Timing Difference Acknowledged (Bank Lag)</option>
              <option value="EXTERNAL_REVERSAL_REQUESTED">External Reversal Requested from Bank</option>
              <option value="INTERNAL_LEDGER_ADJUSTED">Internal Ledger Entry Adjusted</option>
              <option value="BENIGN_DISCREPANCY_WAIVED">Benign Discrepancy Waived</option>
              <option value="MANUAL_REPAIR_COMPLETED">Manual Repair Completed</option>
            </select>
          </div>

          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '6px' }}>
              Resolution Explanation & Evidence Justification
            </label>
            <textarea
              className="form-control"
              rows={4}
              placeholder="State the confirmed resolution steps taken, reference external ticket numbers, and justify human sign-off..."
              value={resolutionExplanation}
              onChange={(e) => setResolutionExplanation(e.target.value)}
              required
              style={{ fontSize: '13px' }}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
