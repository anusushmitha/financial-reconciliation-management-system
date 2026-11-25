import React from 'react';

export interface BorderBeamProps {
  size?: number;
  duration?: number;
  delay?: number;
  colorFrom?: string;
  colorTo?: string;
  borderWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const BorderBeam: React.FC<BorderBeamProps> = ({
  size = 200,
  duration = 8,
  colorFrom = '#2563EB',
  colorTo = '#9333EA',
  className = '',
  style = {},
}) => {
  return (
    <>
      <style>{`
        @keyframes borderBeamTravel {
          100% {
            offset-distance: 100%;
          }
        }
        .border-beam-core {
          pointer-events: none;
          position: absolute;
          inset: 0;
          border-radius: inherit;
          border: 1px solid transparent;
          mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
          mask-composite: exclude;
          -webkit-mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: destination-out;
        }
        .border-beam-core::after {
          content: "";
          position: absolute;
          aspect-ratio: 1;
          width: calc(var(--beam-size) * 1px);
          background: linear-gradient(to left, var(--beam-from), var(--beam-to), transparent);
          offset-anchor: calc(var(--beam-size) * 0.5px) 50%;
          offset-path: rect(0 auto auto 0 round calc(var(--beam-size) * 1px));
          animation: borderBeamTravel var(--beam-duration)s infinite linear;
        }
      `}</style>
      <div
        className={`border-beam-core ${className}`}
        style={
          {
            '--beam-size': size,
            '--beam-duration': duration,
            '--beam-from': colorFrom,
            '--beam-to': colorTo,
            ...style,
          } as React.CSSProperties
        }
      />
    </>
  );
};
