import React from 'react';

interface MiniLineChartProps {
  data: number[];
  dates: string[];
  color?: string;
  gradientId: string;
  height?: number;
  label?: string;
  showPoints?: boolean;
}

export const MiniLineChart: React.FC<MiniLineChartProps> = ({
  data,
  dates,
  color = '#22c55e',
  gradientId,
  height = 90,
  label,
  showPoints = true
}) => {
  if (!data || data.length < 2) return null;

  const maxVal = Math.max(...data);
  const points = data.map((val, idx) => ({
    x: (idx / (data.length - 1)) * 400,
    y: 100 - (val / (maxVal || 1)) * 80
  }));

  const createSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length < 2) return '';
    let path = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return path;
  };

  const smoothPath = createSmoothPath(points);
  const fillPath = `${smoothPath} L 400,100 L 0,100 Z`;

  return (
    <div className="flex-1">
      {label && <div className="text-[12px] text-gray-400 mb-1">{label}</div>}
      <div className="relative" style={{ height: `${height}px` }}>
        <svg className="w-full h-full" viewBox="0 0 400 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.4" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={fillPath} fill={`url(#${gradientId})`} />
          <path
            d={smoothPath}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {showPoints && points.map((point, idx) => (
            <g key={idx}>
              <circle cx={point.x} cy={point.y} r="2.5" fill={color} />
              <text
                x={point.x}
                y={point.y - 6}
                textAnchor="middle"
                fill="#ffffff"
                fontSize="11"
                fontWeight="500"
              >
                {data[idx].toLocaleString()}
              </text>
            </g>
          ))}
        </svg>
        <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[8px] text-gray-400 px-1">
          {dates.map((date, idx) => (
            <span key={idx} className="text-center" style={{ width: `${100 / dates.length}%` }}>
              {date}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
