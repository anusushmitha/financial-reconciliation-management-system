import React from 'react';

export interface ShinyTextProps {
  text: string;
  disabled?: boolean;
  speed?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const ShinyText: React.FC<ShinyTextProps> = ({
  text,
  disabled = false,
  speed = 3,
  className = '',
  style = {},
}) => {
  if (disabled) {
    return <span className={className} style={style}>{text}</span>;
  }

  return (
    <>
      <style>{`
        @keyframes shinySweep {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .shiny-text-shimmer {
          background: linear-gradient(
            110deg,
            currentColor 35%,
            #FFFFFF 50%,
            currentColor 65%
          );
          background-size: 200% 100%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          display: inline-block;
        }
      `}</style>
      <span
        className={`shiny-text-shimmer ${className}`}
        style={{
          animation: `shinySweep ${speed}s linear infinite`,
          ...style,
        }}
      >
        {text}
      </span>
    </>
  );
};
