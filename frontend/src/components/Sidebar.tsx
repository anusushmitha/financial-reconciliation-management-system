import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowLeftRight,
  UploadCloud,
  Layers,
  AlertTriangle,
  BarChart3,
  ShieldCheck,
  Users,
  User,
  LogOut,
  Shield,
  Sliders,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ShinyText } from './reactbits/ShinyText';

export const Sidebar: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();

  return (
    <aside style={{
      width: '250px',
      backgroundColor: 'var(--sidebar)',
      color: '#F8FAFC',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
      flexShrink: 0,
      borderRight: '1px solid #1E293B',
      userSelect: 'none'
    }}>
      {/* Brand Header */}
      <div style={{
        padding: '24px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          backgroundColor: 'var(--primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFFFF'
        }}>
          <Shield size={20} />
        </div>
        <div>
          <h1 style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '0.04em', lineHeight: 1.2, color: '#FFFFFF' }}>
            <ShinyText text="LENDGUARD AI" speed={3.5} />
          </h1>
          <span style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Financial Operations</span>
        </div>
      </div>

      {/* Navigation List */}
      <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
        <NavLink
          to="/dashboard"
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 14px',
            borderRadius: '8px',
            color: isActive ? '#FFFFFF' : '#94A3B8',
            backgroundColor: isActive ? 'var(--primary)' : 'transparent',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 500,
            transition: 'all 0.15s ease'
          })}
        >
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </NavLink>

        <NavLink
          to="/transactions"
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 14px',
            borderRadius: '8px',
            color: isActive ? '#FFFFFF' : '#94A3B8',
            backgroundColor: isActive ? 'var(--primary)' : 'transparent',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 500,
          })}
        >
          <ArrowLeftRight size={18} />
          <span>Transactions</span>
        </NavLink>

        <NavLink
          to="/imports"
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 14px',
            borderRadius: '8px',
            color: isActive ? '#FFFFFF' : '#94A3B8',
            backgroundColor: isActive ? 'var(--primary)' : 'transparent',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 500,
          })}
        >
          <UploadCloud size={18} />
          <span>Imports</span>
        </NavLink>

        <NavLink
          to="/reconciliation-runs"
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 14px',
            borderRadius: '8px',
            color: isActive ? '#FFFFFF' : '#94A3B8',
            backgroundColor: isActive ? 'var(--primary)' : 'transparent',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 500,
          })}
        >
          <Layers size={18} />
          <span>Reconciliation</span>
        </NavLink>

        <NavLink
          to="/exceptions"
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 14px',
            borderRadius: '8px',
            color: isActive ? '#FFFFFF' : '#94A3B8',
            backgroundColor: isActive ? 'var(--primary)' : 'transparent',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 500,
          })}
        >
          <AlertTriangle size={18} />
          <span>Exceptions</span>
        </NavLink>

        <NavLink
          to="/reports"
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 14px',
            borderRadius: '8px',
            color: isActive ? '#FFFFFF' : '#94A3B8',
            backgroundColor: isActive ? 'var(--primary)' : 'transparent',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 500,
          })}
        >
          <BarChart3 size={18} />
          <span>Reports</span>
        </NavLink>

        {isAdmin && (
          <>
            <div style={{ margin: '16px 12px 6px', fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Administration
            </div>

            <NavLink
              to="/rules"
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                borderRadius: '8px',
                color: isActive ? '#FFFFFF' : '#94A3B8',
                backgroundColor: isActive ? 'var(--primary)' : 'transparent',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 500,
              })}
            >
              <Sliders size={18} />
              <span>Policy & Rules</span>
            </NavLink>

            <NavLink
              to="/audit-logs"
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                borderRadius: '8px',
                color: isActive ? '#FFFFFF' : '#94A3B8',
                backgroundColor: isActive ? 'var(--primary)' : 'transparent',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 500,
              })}
            >
              <ShieldCheck size={18} />
              <span>Audit History</span>
            </NavLink>

            <NavLink
              to="/users"
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                borderRadius: '8px',
                color: isActive ? '#FFFFFF' : '#94A3B8',
                backgroundColor: isActive ? 'var(--primary)' : 'transparent',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 500,
              })}
            >
              <Users size={18} />
              <span>User Management</span>
            </NavLink>
          </>
        )}

        <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <NavLink
            to="/profile"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              borderRadius: '8px',
              color: isActive ? '#FFFFFF' : '#94A3B8',
              backgroundColor: isActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 500,
            })}
          >
            <User size={18} />
            <span>My Profile</span>
          </NavLink>
        </div>
      </nav>

      {/* User Section & Logout */}
      <div style={{
        padding: '16px',
        backgroundColor: '#0B1120',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: '#334155',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '13px',
            fontWeight: 600,
            flexShrink: 0
          }}>
            {user?.fullName?.charAt(0) || 'U'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#F8FAFC', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {user?.fullName || 'User'}
            </div>
            <div style={{ fontSize: '11px', color: '#94A3B8', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {user?.role}
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          title="Sign out"
          style={{
            background: 'none',
            border: 'none',
            color: '#94A3B8',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#EF4444')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#94A3B8')}
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
};
