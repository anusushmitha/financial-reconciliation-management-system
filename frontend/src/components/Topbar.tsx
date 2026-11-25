import React from 'react';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from './Badge';
import { Bell, ShieldCheck, Activity, Search, Sliders } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ShinyText } from './reactbits/ShinyText';

interface TopbarProps {
  title: string;
  subtitle?: string;
  onOpenCommandPalette?: () => void;
  isCompact?: boolean;
  onToggleDensity?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  title,
  subtitle,
  onOpenCommandPalette,
  isCompact = false,
  onToggleDensity,
}) => {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  return (
    <header
      style={{
        height: '64px',
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 28px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.01em' }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
            {subtitle}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Astryx Omnibar Quick Search Trigger */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            borderRadius: '8px',
            border: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            color: '#64748B',
            fontSize: '12px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          title="Open Command Palette (Ctrl+K)"
        >
          <Search size={14} style={{ color: 'var(--primary)' }} />
          <span style={{ fontWeight: 500 }}>Search or jump to...</span>
          <kbd
            style={{
              fontSize: '10px',
              fontFamily: 'monospace',
              padding: '1px 5px',
              borderRadius: '4px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              color: '#475569',
              fontWeight: 600,
            }}
          >
            Ctrl K
          </kbd>
        </button>

        {/* Astryx Table Density Switcher */}
        {onToggleDensity && (
          <button
            type="button"
            onClick={onToggleDensity}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              borderRadius: '8px',
              border: isCompact ? '1px solid var(--primary)' : '1px solid #E2E8F0',
              backgroundColor: isCompact ? 'rgba(37, 99, 235, 0.08)' : '#FFFFFF',
              color: isCompact ? 'var(--primary)' : '#64748B',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            title={isCompact ? 'Current: Compact Mode (Dense rows). Click for Comfortable.' : 'Current: Comfortable Mode. Click for Compact.'}
          >
            <Sliders size={13} />
            <span>{isCompact ? 'Density: Compact' : 'Density: Normal'}</span>
          </button>
        )}

        {/* Astryx Staging Cluster Status indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#F0FDF4',
            padding: '5px 12px',
            borderRadius: '20px',
            border: '1px solid #BBF7D0',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#16A34A',
              display: 'inline-block',
              boxShadow: '0 0 8px rgba(22, 163, 74, 0.8)',
            }}
          />
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#166534', letterSpacing: '0.02em' }}>
            <ShinyText text="AI CLUSTER ONLINE • 14ms" speed={3} />
          </span>
        </div>

        {/* Quick Demo Persona Switcher */}
        <select
          onChange={async (e) => {
            const val = e.target.value;
            if (!val) return;
            try {
              if (val === 'admin') {
                await login('staging.admin@lendguard.internal', 'StagingAdmin_Secure2026!');
              } else if (val === 'op_analyst') {
                await login('staging.analyst@lendguard.internal', 'StagingAnalyst_Secure2026!');
              } else if (val === 'anu') {
                await login('sanushusmitha@gmail.com', 'Analyst123!');
              }
              window.location.reload();
            } catch (err) {
              console.error('Failed to switch persona', err);
            }
          }}
          value=""
          style={{
            fontSize: '11px',
            fontWeight: 600,
            padding: '5px 8px',
            borderRadius: '6px',
            border: '1px solid #CBD5E1',
            backgroundColor: '#F8FAFC',
            color: '#334155',
            cursor: 'pointer',
          }}
          title="Switch Active Persona Instantly"
        >
          <option value="" disabled>
            ⚡ Switch Persona
          </option>
          <option value="admin">Admin (Full Control)</option>
          <option value="op_analyst">Operational Analyst</option>
          <option value="anu">Anu Sushmitha (Analyst)</option>
        </select>

        {/* User Card */}
        {user && (
          <div
            onClick={() => navigate('/profile')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '6px 10px',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
            title="View Profile"
          >
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: '13px',
              }}
            >
              {user.fullName ? user.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'U'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.2 }}>
                {user.fullName}
              </span>
              <div style={{ marginTop: '2px' }}>
                <StatusBadge status={user.role} size="sm" />
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
