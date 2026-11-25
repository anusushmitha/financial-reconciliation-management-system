import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/Badge';
import { User, Mail, Shield, LogOut, KeyRound, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const ProfilePage: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <div style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Identity Card */}
      <div className="card" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '24px', marginBottom: '24px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              fontWeight: 700,
            }}
          >
            {user.fullName ? user.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : 'U'}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                {user.fullName}
              </h2>
              <StatusBadge status={user.role} />
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              User ID: <span style={{ fontFamily: 'monospace' }}>{user.id}</span>
            </p>
          </div>

          <button
            className="btn btn-secondary"
            onClick={handleLogout}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#DC2626', borderColor: '#FECACA' }}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Credentials and Details */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <span style={{ fontSize: '12px', color: '#64748B', display: 'block', marginBottom: '4px' }}>
              Primary Work Email
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600 }}>
              <Mail size={16} color="var(--primary)" />
              <span>{user.email}</span>
            </div>
          </div>

          <div>
            <span style={{ fontSize: '12px', color: '#64748B', display: 'block', marginBottom: '4px' }}>
              Access Level & Role
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600 }}>
              <Shield size={16} color={isAdmin ? '#7C3AED' : 'var(--primary)'} />
              <span>{isAdmin ? 'System Administrator (Full RBAC)' : 'Operations Analyst (Reconciliation & Investigation)'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Permissions Breakdown */}
      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 16px' }}>
          Authorized Platform Capabilities
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', backgroundColor: '#F8FAFC', borderRadius: '6px' }}>
            <CheckCircle2 size={16} color="#16A34A" />
            <span>CSV Batch File Ingestion & Row-Level Validation Execution</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', backgroundColor: '#F8FAFC', borderRadius: '6px' }}>
            <CheckCircle2 size={16} color="#16A34A" />
            <span>Deterministic Two-Sided Reconciliation Batch Runs (RC-01 - RC-08)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', backgroundColor: '#F8FAFC', borderRadius: '6px' }}>
            <CheckCircle2 size={16} color="#16A34A" />
            <span>Exception Investigation, AI Explanation Triggering & Reviewer Resolution Sign-Off</span>
          </div>
          {isAdmin && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', backgroundColor: '#F5F3FF', borderRadius: '6px' }}>
                <CheckCircle2 size={16} color="#7C3AED" />
                <span>Employee Account Provisioning, Deactivation, and Role Management</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', backgroundColor: '#F5F3FF', borderRadius: '6px' }}>
                <CheckCircle2 size={16} color="#7C3AED" />
                <span>Immutable Regulatory Compliance Audit Trail Access</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
