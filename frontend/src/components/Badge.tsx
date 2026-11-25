import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 
    | 'default'
    | 'primary'
    | 'success'
    | 'warning'
    | 'danger'
    | 'info'
    | 'neutral'
    | 'purple';
  size?: 'sm' | 'md';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
}) => {
  const getColors = () => {
    switch (variant) {
      case 'success':
        return { bg: 'rgba(22, 163, 74, 0.1)', color: '#16A34A', border: 'rgba(22, 163, 74, 0.25)', dot: '#16A34A' };
      case 'warning':
        return { bg: 'rgba(217, 119, 6, 0.1)', color: '#D97706', border: 'rgba(217, 119, 6, 0.25)', dot: '#D97706' };
      case 'danger':
        return { bg: 'rgba(220, 38, 38, 0.1)', color: '#DC2626', border: 'rgba(220, 38, 38, 0.25)', dot: '#DC2626' };
      case 'info':
        return { bg: 'rgba(37, 99, 235, 0.1)', color: '#2563EB', border: 'rgba(37, 99, 235, 0.25)', dot: '#2563EB' };
      case 'purple':
        return { bg: 'rgba(124, 58, 237, 0.1)', color: '#7C3AED', border: 'rgba(124, 58, 237, 0.25)', dot: '#7C3AED' };
      case 'neutral':
        return { bg: '#F1F5F9', color: '#475569', border: '#CBD5E1', dot: '#64748B' };
      case 'primary':
      default:
        return { bg: 'rgba(37, 99, 235, 0.08)', color: 'var(--primary)', border: 'rgba(37, 99, 235, 0.2)', dot: 'var(--primary)' };
    }
  };

  const colors = getColors();

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: size === 'sm' ? '2px 8px' : '4px 10px',
        fontSize: size === 'sm' ? '11px' : '12px',
        fontWeight: 600,
        lineHeight: 1.2,
        borderRadius: '9999px',
        backgroundColor: colors.bg,
        color: colors.color,
        border: `1px solid ${colors.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {dot && (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: colors.dot,
          }}
        />
      )}
      {children}
    </span>
  );
};

export const StatusBadge: React.FC<{ status: string; size?: 'sm' | 'md' }> = ({ status, size = 'md' }) => {
  const norm = (status || '').toUpperCase();
  let variant: BadgeProps['variant'] = 'neutral';

  if (['COMPLETED', 'RESOLVED', 'CONFIRMED', 'MATCHED', 'VALIDATED', 'ACTIVE'].includes(norm)) {
    variant = 'success';
  } else if (['PROCESSING', 'IN_PROGRESS', 'QUEUED'].includes(norm)) {
    variant = 'info';
  } else if (['PENDING', 'DRAFT', 'WARNING', 'MEDIUM', 'ANOMALY'].includes(norm)) {
    variant = 'warning';
  } else if (['FAILED', 'REJECTED', 'CRITICAL', 'HIGH', 'EXCEPTION', 'UNMATCHED'].includes(norm)) {
    variant = 'danger';
  } else if (['ADMIN'].includes(norm)) {
    variant = 'purple';
  } else if (['ANALYST'].includes(norm)) {
    variant = 'info';
  } else if (['INTERNAL'].includes(norm)) {
    variant = 'primary';
  } else if (['EXTERNAL'].includes(norm)) {
    variant = 'neutral';
  }

  return (
    <Badge variant={variant} size={size} dot>
      {norm}
    </Badge>
  );
};

export const SeverityBadge: React.FC<{ severity: string; size?: 'sm' | 'md' }> = ({ severity, size = 'md' }) => {
  const norm = (severity || '').toUpperCase();
  let variant: BadgeProps['variant'] = 'neutral';

  switch (norm) {
    case 'CRITICAL':
      variant = 'danger';
      break;
    case 'HIGH':
      variant = 'danger';
      break;
    case 'MEDIUM':
      variant = 'warning';
      break;
    case 'LOW':
    default:
      variant = 'neutral';
      break;
  }

  return (
    <Badge variant={variant} size={size} dot>
      {norm}
    </Badge>
  );
};
