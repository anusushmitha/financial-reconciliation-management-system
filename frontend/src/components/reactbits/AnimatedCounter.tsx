import React, { useEffect, useState, useRef } from 'react';

export interface AnimatedCounterProps {
  value?: number;
  end?: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  end,
  duration = 1000,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
  style = {},
}) => {
  const targetValue = value !== undefined ? value : end !== undefined ? end : 0;
  const [displayValue, setDisplayValue] = useState(0);
  const startValueRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const startValue = startValueRef.current;
    const diff = targetValue - startValue;
    if (diff === 0) return;

    let animId: number;

    const easeOutCubic = (t: number): number => {
      return 1 - Math.pow(1 - t, 3);
    };

    const step = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
      const easedProgress = easeOutCubic(progress);
      const current = startValue + diff * easedProgress;

      setDisplayValue(current);

      if (progress < 1) {
        animId = requestAnimationFrame(step);
      } else {
        startValueRef.current = targetValue;
        startTimeRef.current = null;
      }
    };

    startTimeRef.current = null;
    animId = requestAnimationFrame(step);

    return () => cancelAnimationFrame(animId);
  }, [targetValue, duration]);

  const formatted = displayValue.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span className={`animated-counter ${className}`} style={{ fontVariantNumeric: 'tabular-nums', ...style }}>
      {prefix}{formatted}{suffix}
    </span>
  );
};
