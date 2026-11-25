import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AlertCircle, Lock, Mail, ArrowRight } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isExpired = new URLSearchParams(location.search).get('expired') === 'true';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    try {
      setError(null);
      setLoading(true);
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (preset: 'admin' | 'analyst' | 'anu' | 'co_admin') => {
    switch (preset) {
      case 'admin':
        setEmail('staging.admin@lendguard.internal');
        setPassword('StagingAdmin_Secure2026!');
        break;
      case 'analyst':
        setEmail('staging.analyst@lendguard.internal');
        setPassword('StagingAnalyst_Secure2026!');
        break;
      case 'anu':
        setEmail('sanushusmitha@gmail.com');
        setPassword('Analyst123!');
        break;
      case 'co_admin':
        setEmail('admin@example.com');
        setPassword('Admin123!');
        break;
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 4px' }}>
          Sign In to Your Workspace
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
          Enter your authorized enterprise credentials to access the platform.
        </p>
      </div>

      {isExpired && (
        <div style={{
          backgroundColor: '#FFFBEB',
          border: '1px solid #FDE68A',
          color: '#B45309',
          padding: '10px 14px',
          borderRadius: '8px',
          fontSize: '13px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <AlertCircle size={16} />
          <span>Your session has expired. Please sign in again.</span>
        </div>
      )}

      {error && (
        <div style={{
          backgroundColor: '#FEF2F2',
          border: '1px solid #FECACA',
          color: '#DC2626',
          padding: '10px 14px',
          borderRadius: '8px',
          fontSize: '13px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: '6px' }}>
            Work Email Address
          </label>
          <div style={{ position: 'relative' }}>
            <Mail size={18} style={{ position: 'absolute', left: '12px', top: '11px', color: '#94A3B8' }} />
            <input
              type="email"
              className="form-control"
              placeholder="e.g. name@lendguard.internal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ paddingLeft: '38px' }}
              required
            />
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label className="form-label" style={{ margin: 0 }}>Password</label>
            <Link to="/forgot-password" style={{ fontSize: '12px', color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
              Forgot password?
            </Link>
          </div>
          <div style={{ position: 'relative' }}>
            <Lock size={18} style={{ position: 'absolute', left: '12px', top: '11px', color: '#94A3B8' }} />
            <input
              type="password"
              className="form-control"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ paddingLeft: '38px' }}
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          style={{ width: '100%', marginTop: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
        >
          {loading ? 'Authenticating...' : (
            <>
              <span>Sign In</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      {/* Quick Demo Credential Presets with Astryx Tokens */}
      <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid #E2E8F0', textAlign: 'center' }}>
        <p style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>
          One-Click Authorized Persona Switcher
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: '12px', padding: '8px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', backgroundColor: '#F8FAFC' }}
            onClick={() => fillCredentials('admin')}
          >
            <span style={{ fontWeight: 600, color: 'var(--primary)' }}>Administrator</span>
            <span style={{ fontSize: '10px', color: '#94A3B8' }}>staging.admin (Full Control)</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: '12px', padding: '8px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', backgroundColor: '#F8FAFC' }}
            onClick={() => fillCredentials('analyst')}
          >
            <span style={{ fontWeight: 600, color: '#16A34A' }}>Operational Analyst</span>
            <span style={{ fontSize: '10px', color: '#94A3B8' }}>staging.analyst (Queue)</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: '12px', padding: '8px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', backgroundColor: '#F8FAFC' }}
            onClick={() => fillCredentials('anu')}
          >
            <span style={{ fontWeight: 600, color: '#8B5CF6' }}>Anu Sushmitha</span>
            <span style={{ fontSize: '10px', color: '#94A3B8' }}>sanushusmitha@gmail.com</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: '12px', padding: '8px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', backgroundColor: '#F8FAFC' }}
            onClick={() => fillCredentials('co_admin')}
          >
            <span style={{ fontWeight: 600, color: '#0284C7' }}>Dev Admin</span>
            <span style={{ fontSize: '10px', color: '#94A3B8' }}>admin@example.com</span>
          </button>
        </div>
      </div>
    </div>
  );
};
