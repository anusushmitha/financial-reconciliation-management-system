import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';
import { CommandPalette } from '../components/CommandPalette';

const pageTitles: Record<string, { title: string; subtitle?: string }> = {
  '/dashboard': { title: 'Operational Dashboard', subtitle: 'Reconciliation KPIs, trend analytics, and real-time exceptions' },
  '/transactions': { title: 'Transactions Ledger', subtitle: 'Search, filter, and inspect internal and external transactions' },
  '/imports': { title: 'Transaction Imports', subtitle: 'Upload and validate loan repayments and settlement CSV data' },
  '/reconciliation-runs': { title: 'Reconciliation Runs', subtitle: 'Deterministic batch matching engine execution and results' },
  '/exceptions': { title: 'Discrepancy & Exception Queue', subtitle: 'Investigate, assign, and resolve reconciliation discrepancies' },
  '/reports': { title: 'Reports & Analytics', subtitle: 'Detailed reconciliation and exception performance reports' },
  '/audit-logs': { title: 'Audit Trail & Compliance', subtitle: 'Immutable tamper-evident record of all system events' },
  '/users': { title: 'User Management', subtitle: 'Configure user access, RBAC permissions, and account status' },
  '/profile': { title: 'User Profile & Security', subtitle: 'Manage personal credentials and active session' },
};

export const AppLayout: React.FC = () => {
  const location = useLocation();
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(() => localStorage.getItem('lendguard_density') === 'compact');

  const toggleDensity = () => {
    setIsCompact((prev) => {
      const next = !prev;
      localStorage.setItem('lendguard_density', next ? 'compact' : 'comfortable');
      return next;
    });
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Find matching title or default
  let pageInfo = pageTitles[location.pathname];
  if (!pageInfo) {
    if (location.pathname.startsWith('/transactions/')) {
      pageInfo = { title: 'Transaction Detail', subtitle: 'Raw payload, linked match records, and discrepancy status' };
    } else if (location.pathname.startsWith('/reconciliation-runs/')) {
      pageInfo = { title: 'Reconciliation Run Details', subtitle: 'Rule-based matching breakdown and exception outcomes' };
    } else if (location.pathname.startsWith('/exceptions/')) {
      pageInfo = { title: 'Exception Investigation Workspace', subtitle: 'Side-by-side reconciliation evidence and AI advisory analysis' };
    } else if (location.pathname.includes('/validation')) {
      pageInfo = { title: 'Batch Validation Results', subtitle: 'Row-level syntax, reference, and duplicate error inspection' };
    } else {
      pageInfo = { title: 'LENDGUARD AI', subtitle: 'Intelligent Financial Transaction Reconciliation Platform' };
    }
  }

  return (
    <div className={isCompact ? 'density-compact' : ''} style={{ display: 'flex', width: '100%', minHeight: '100vh', backgroundColor: '#F8FAFC' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowX: 'hidden' }}>
        <Topbar
          title={pageInfo.title}
          subtitle={pageInfo.subtitle}
          onOpenCommandPalette={() => setIsCommandOpen(true)}
          isCompact={isCompact}
          onToggleDensity={toggleDensity}
        />
        <main style={{ flex: 1, padding: '28px', maxWidth: '1440px', width: '100%', margin: '0 auto' }}>
          <Outlet />
        </main>
      </div>

      {/* Global Command Palette Omnibar */}
      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        onToggleDensity={toggleDensity}
      />
    </div>
  );
};
