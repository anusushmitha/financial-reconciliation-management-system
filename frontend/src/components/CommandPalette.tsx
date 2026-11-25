import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  LayoutDashboard,
  Layers,
  AlertTriangle,
  ArrowLeftRight,
  UploadCloud,
  FileText,
  ShieldCheck,
  Users,
  User,
  Sliders,
  Play,
  ArrowRight,
  CornerDownLeft,
} from 'lucide-react';
import { BorderBeam } from './reactbits/BorderBeam';
import { ShinyText } from './reactbits/ShinyText';

export interface CommandItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'Actions' | 'Navigation';
  icon: React.ElementType;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onToggleDensity?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onToggleDensity }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const commands: CommandItem[] = [
    {
      id: 'act-reconcile',
      title: 'Run Deterministic Reconciliation',
      subtitle: 'Execute multi-pass matching engine on confirmed batches',
      category: 'Actions',
      icon: Play,
      shortcut: 'R',
      action: () => {
        navigate('/reconciliation-runs');
        onClose();
      },
    },
    {
      id: 'act-import',
      title: 'Upload CSV Transaction Batch',
      subtitle: 'Ingest core repayments or external bank statements (S07)',
      category: 'Actions',
      icon: UploadCloud,
      shortcut: 'U',
      action: () => {
        navigate('/imports');
        onClose();
      },
    },
    {
      id: 'act-exceptions',
      title: 'Investigate Exceptions Queue',
      subtitle: 'Review discrepancies flagged with Tri-Model AI anomaly scores',
      category: 'Actions',
      icon: AlertTriangle,
      shortcut: 'E',
      action: () => {
        navigate('/exceptions');
        onClose();
      },
    },
    {
      id: 'act-density',
      title: 'Toggle Astryx Table Density',
      subtitle: 'Switch between Compact (dense financial rows) and Comfortable mode',
      category: 'Actions',
      icon: Sliders,
      shortcut: 'D',
      action: () => {
        if (onToggleDensity) onToggleDensity();
        onClose();
      },
    },
    {
      id: 'nav-dashboard',
      title: 'Operational Dashboard',
      subtitle: 'Real-time KPIs, match rates, and active discrepancy queue',
      category: 'Navigation',
      icon: LayoutDashboard,
      action: () => {
        navigate('/dashboard');
        onClose();
      },
    },
    {
      id: 'nav-transactions',
      title: 'Transactions Ledger',
      subtitle: 'Search and inspect raw internal and external ledger records',
      category: 'Navigation',
      icon: ArrowLeftRight,
      action: () => {
        navigate('/transactions');
        onClose();
      },
    },
    {
      id: 'nav-runs',
      title: 'Reconciliation Runs History',
      subtitle: 'Audit matching batch execution history and match efficacy',
      category: 'Navigation',
      icon: Layers,
      action: () => {
        navigate('/reconciliation-runs');
        onClose();
      },
    },
    {
      id: 'nav-reports',
      title: 'Reports & Analytics',
      subtitle: 'Detailed reconciliation and exception performance reports',
      category: 'Navigation',
      icon: FileText,
      action: () => {
        navigate('/reports');
        onClose();
      },
    },
    {
      id: 'nav-audit',
      title: 'Audit Trail & Compliance',
      subtitle: 'Immutable tamper-evident record of all system events (SOX 404)',
      category: 'Navigation',
      icon: ShieldCheck,
      action: () => {
        navigate('/audit-logs');
        onClose();
      },
    },
    {
      id: 'nav-users',
      title: 'User Management',
      subtitle: 'Configure RBAC analyst access and assignment controls',
      category: 'Navigation',
      icon: Users,
      action: () => {
        navigate('/users');
        onClose();
      },
    },
    {
      id: 'nav-profile',
      title: 'User Profile & Security',
      subtitle: 'Manage credentials and active authentication session',
      category: 'Navigation',
      icon: User,
      action: () => {
        navigate('/profile');
        onClose();
      },
    },
  ];

  const filteredCommands = commands.filter((cmd) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      cmd.title.toLowerCase().includes(q) ||
      cmd.subtitle.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          onClose(); // Inverted in parent toggle
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '620px',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(226, 232, 240, 0.8)',
          overflow: 'hidden',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <BorderBeam size={280} duration={8} colorFrom="#2563EB" colorTo="#38BDF8" borderWidth={2} />

        {/* Input Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 20px',
            borderBottom: '1px solid #E2E8F0',
          }}
        >
          <Search size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command, action, or navigate..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              fontSize: '15px',
              color: '#0F172A',
              fontWeight: 500,
              backgroundColor: 'transparent',
            }}
          />
          <span
            style={{
              fontSize: '11px',
              fontFamily: 'monospace',
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: '#F1F5F9',
              color: '#64748B',
              border: '1px solid #E2E8F0',
            }}
          >
            ESC
          </span>
        </div>

        {/* Results List */}
        <div style={{ maxHeight: '380px', overflowY: 'auto', padding: '10px 8px' }}>
          {filteredCommands.length === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
              No matching commands found for "{query}".
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              const Icon = cmd.icon;
              return (
                <div
                  key={cmd.id}
                  onClick={cmd.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                    transition: 'background-color 0.1s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '8px',
                        backgroundColor: isSelected ? 'var(--primary)' : '#F1F5F9',
                        color: isSelected ? '#FFFFFF' : '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Icon size={18} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: isSelected ? 'var(--primary)' : '#1E293B', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{cmd.title}</span>
                        {cmd.category === 'Actions' && (
                          <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', backgroundColor: '#EFF6FF', color: 'var(--primary)', fontWeight: 700 }}>
                            ACTION
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cmd.subtitle}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {cmd.shortcut && (
                      <kbd
                        style={{
                          fontSize: '11px',
                          fontFamily: 'monospace',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: '#F8FAFC',
                          border: '1px solid #CBD5E1',
                          color: '#475569',
                        }}
                      >
                        {cmd.shortcut}
                      </kbd>
                    )}
                    {isSelected && <CornerDownLeft size={14} style={{ color: 'var(--primary)' }} />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 16px',
            backgroundColor: '#F8FAFC',
            borderTop: '1px solid #E2E8F0',
            fontSize: '11px',
            color: '#64748B',
          }}
        >
          <div style={{ display: 'flex', gap: '14px' }}>
            <span><kbd style={{ padding: '1px 4px', borderRadius: '3px', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1' }}>↑</kbd> <kbd style={{ padding: '1px 4px', borderRadius: '3px', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1' }}>↓</kbd> Navigate</span>
            <span><kbd style={{ padding: '1px 4px', borderRadius: '3px', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1' }}>↵</kbd> Select</span>
            <span><kbd style={{ padding: '1px 4px', borderRadius: '3px', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1' }}>Esc</kbd> Close</span>
          </div>
          <div>
            <ShinyText text="Astryx Omnibar v2.0" speed={3.5} />
          </div>
        </div>
      </div>
    </div>
  );
};
