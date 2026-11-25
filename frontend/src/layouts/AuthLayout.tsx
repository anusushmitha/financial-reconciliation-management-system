import React from 'react';
import { Outlet } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { ShinyText } from '../components/reactbits/ShinyText';
import { BorderBeam } from '../components/reactbits/BorderBeam';

export const AuthLayout: React.FC = () => {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0F172A',
        backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px), radial-gradient(at 0% 0%, rgba(37, 99, 235, 0.2) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(15, 23, 42, 0.9) 0px, transparent 50%)',
        backgroundSize: '24px 24px, 100% 100%, 100% 100%',
        padding: '24px',
        position: 'relative',
      }}
    >
      <div style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 1 }}>
        {/* Brand header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '14px',
              backgroundColor: 'var(--primary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 10px 25px -3px rgba(37, 99, 235, 0.4)',
              marginBottom: '16px',
            }}
          >
            <Shield size={28} />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            <ShinyText text="LENDGUARD AI" speed={3} />
          </h1>
          <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '6px' }}>
            Intelligent Financial Transaction Reconciliation & Exception Management
          </p>
        </div>

        {/* Card for child form with React Bits BorderBeam */}
        <div
          className="card"
          style={{
            backgroundColor: '#FFFFFF',
            padding: '36px',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <BorderBeam size={260} duration={8} colorFrom="#2563EB" colorTo="#38BDF8" borderWidth={2} />
          <Outlet />
        </div>

        {/* Security footer */}
        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '12px', color: '#64748B' }}>
          <span>Deterministic rule engine • Dual-control advisory AI • SOC2 compliant architecture</span>
        </div>
      </div>
    </div>
  );
};
