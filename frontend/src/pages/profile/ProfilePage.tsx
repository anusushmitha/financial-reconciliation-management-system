import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { StatusBadge } from '../../components/Badge';
import { Mail, Shield, LogOut, KeyRound, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const ProfilePage: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      addToast('New password must be at least 8 characters.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast('New password and confirmation do not match.', 'error');
      return;
    }
    try {
      setChangingPass(true);
      await api.changePassword(currentPassword, newPassword);
      addToast('Password changed and audited successfully.', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      addToast(err?.message || 'Failed to change password.', 'error');
    } finally {
      setChangingPass(false);
    }
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
                <span>Immutable Regulatory Compliance Audit Trail Access</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Security & Self-Service Password Update */}
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <KeyRound size={18} color="var(--primary)" />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
            Security & Password Management
          </h3>
        </div>

        <form onSubmit={handleChangePassword} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px', alignItems: 'end' }}>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Current Password</label>
            <input
              type="password"
              className="form-control"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>New Password (8+ chars)</label>
            <input
              type="password"
              className="form-control"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Confirm New Password</label>
            <input
              type="password"
              className="form-control"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <button type="submit" className="btn btn-primary" disabled={changingPass} style={{ width: '100%' }}>
              {changingPass ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
