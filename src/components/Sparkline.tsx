/** Dependency-free SVG sparkline with a soft gold area fill. */

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  stroke?: string;
  id?: string;
}

export function Sparkline({
  data,
  width = 320,
  height = 64,
  className,
  stroke = "var(--gold)",
  id = "spark",
}: SparklineProps) {
  if (data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pad = 3;

  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * (width - pad * 2) + pad;
    const y = height - pad - ((value - min) / range) * (height - pad * 2);
    return [x, y] as const;
  });

  const line = points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `${pad},${height} ${line} ${width - pad},${height}`;
  const gradId = `${id}-grad`;
  const last = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gradId})`} />
      <polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill={stroke} />
    </svg>
  );
}
