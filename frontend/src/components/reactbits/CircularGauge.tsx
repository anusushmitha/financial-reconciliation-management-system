import React, { useEffect, useState } from 'react';
import { AnimatedCounter } from './AnimatedCounter';

export interface CircularGaugeProps {
  value: number; // 0 to 100
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  color?: string;
}

export const CircularGauge: React.FC<CircularGaugeProps> = ({
  value,
  size = 140,
  strokeWidth = 10,
  label = 'Match Rate',
  sublabel,
  color,
}) => {
  const [animatedOffset, setAnimatedOffset] = useState(100);
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;

  // Determine color based on financial match rate or user override
  const gaugeColor =
    color || (value >= 90 ? '#16A34A' : value >= 75 ? '#D97706' : '#DC2626');
  const trackColor = '#E2E8F0';

  useEffect(() => {
    const clamped = Math.min(Math.max(value, 0), 100);
    const offset = circumference - (clamped / 100) * circumference;
    const timer = setTimeout(() => {
      setAnimatedOffset(offset);
    }, 100);
    return () => clearTimeout(timer);
  }, [value, circumference]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background circle track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={trackColor}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Animated active progress stroke */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={gaugeColor}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={animatedOffset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.3s ease',
            }}
          />
        </svg>

        {/* Center Text */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontSize: '24px', fontWeight: 800, color: gaugeColor, lineHeight: 1 }}>
            <AnimatedCounter value={value} decimals={1} suffix="%" duration={1100} />
          </div>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {label}
          </span>
        </div>
      </div>
      {sublabel && (
        <span style={{ fontSize: '11px', color: '#94A3B8', marginTop: '6px' }}>{sublabel}</span>
      )}
    </div>
  );
};
