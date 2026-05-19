interface Props {
  size: number;
  strokeWidth: number;
  progress: number; // 0-100
  color: string;
  children?: React.ReactNode;
}

export function ProgressRing({ size, strokeWidth, progress, color, children }: Props) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (progress / 100) * circ;

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      {children && (
        <foreignObject
          x={0}
          y={0}
          width={size}
          height={size}
          style={{ transform: 'rotate(90deg)', transformOrigin: `${size / 2}px ${size / 2}px` }}
        >
          <div
            style={{ width: size, height: size }}
            className="flex items-center justify-center"
          >
            {children}
          </div>
        </foreignObject>
      )}
    </svg>
  );
}
