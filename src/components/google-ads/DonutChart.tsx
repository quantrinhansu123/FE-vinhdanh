import React from 'react';

interface DonutSegment {
  percentage: number;
  color: string;
}

interface DonutChartProps {
  percentage?: number;
  label: string;
  color?: string;
  segments?: DonutSegment[];
  width?: number;
  height?: number;
  percentageFontSize?: number;
  labelFontSize?: number;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  percentage,
  label,
  color = '#22c55e',
  segments,
  width = 110,
  height = 90,
  percentageFontSize = 14,
  labelFontSize = 8
}) => {
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  
  // Base display percentage
  const displayPercentage = percentage !== undefined ? percentage : (segments?.reduce((acc, s) => acc + s.percentage, 0) || 0);

  return (
    <div style={{ width: `${width}px` }} className="flex-shrink-0">
      <div className="text-[12px] text-gray-400 mb-1">{label}</div>
      <div className="relative flex items-center justify-center" style={{ height: `${height}px` }}>
        <svg className="w-full h-full" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#1e293b" strokeWidth="11" />
          
          {segments ? (
            // Multiple segments
            (() => {
              let currentOffset = 0;
              return segments.map((segment, idx) => {
                const strokeDashoffset = circumference - (segment.percentage / 100) * circumference;
                const rotation = (currentOffset / 100) * 360 - 90;
                currentOffset += segment.percentage;
                return (
                  <circle
                    key={idx}
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth="11"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    transform={`rotate(${rotation} 50 50)`}
                  />
                );
              });
            })()
          ) : (
            // Single segment
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth="11"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - (displayPercentage / 100) * circumference}
              transform="rotate(-90 50 50)"
            />
          )}

          <text x="50" y="48" textAnchor="middle" fill="#fff" fontSize={percentageFontSize} fontWeight="bold">
            {displayPercentage.toFixed(1)}%
          </text>
          <text x="50" y="58" textAnchor="middle" fill="#9ca3af" fontSize={labelFontSize} className="uppercase tracking-wider">
            {label}
          </text>
        </svg>
      </div>
    </div>
  );
};
