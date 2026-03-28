import React from 'react';

interface SummaryChartProps {
  title: string;
  type: 'bar-line' | 'bar' | 'line' | 'donut';
  color?: string;
  secondaryColor?: string;
  line2Color?: string;
  height?: number;
  yLeftLabels?: string[];
  yRightLabels?: string[];
  xLabels?: string[];
  barData?: number[]; // Percent of height (0-100)
  lineData?: number[]; // Percent of height (0-100)
  line2Data?: number[]; // Percent of height (0-100)
}

export const SummaryChart: React.FC<SummaryChartProps> = ({ 
  title, 
  type, 
  color = '#f59e0b', 
  secondaryColor = '#10b981', 
  line2Color = '#eab308',
  height = 240,
  yLeftLabels = ["600 M", "300 M", "0"],
  yRightLabels = ["3 M", "1.5 M", "0"],
  xLabels = ["08", "09", "10", "11"],
  barData = [50, 85, 50, 30],
  lineData = [60, 75, 75, 50],
  line2Data = [10, 10, 75, 60]
}) => {
  const chartId = React.useId().replace(/:/g, '');
  
  return (
    <div className="flex flex-col gap-6 border border-white/5 p-6 rounded-2xl bg-ads-card/40 backdrop-blur-md hover:border-emerald-500/20 transition-all duration-300">
      <div className="flex justify-between items-center px-1">
        <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.15em]">{title}</h4>
      </div>
      
      <div className="relative" style={{ height: `${height}px` }}>
        <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 1000 200">
          <defs>
            <linearGradient id={`grad-${chartId}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.8" />
              <stop offset="100%" stopColor={color} stopOpacity="0.2" />
            </linearGradient>
            <filter id={`glow-${chartId}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid lines */}
          {[50, 100, 150].map((y) => (
            <line 
              key={y} 
              x1="100" y1={y} x2="900" y2={y} 
              stroke="white" 
              strokeWidth="0.5" 
              strokeOpacity="0.05" 
              strokeDasharray="4 4" 
            />
          ))}
          
          {/* Bars */}
          {(type === 'bar-line' || type === 'bar') && xLabels.map((_, i) => {
            const itemCount = xLabels.length;
            const chartAreaWidth = 800;
            const step = chartAreaWidth / Math.max(1, itemCount - 1);
            const x = 100 + i * step;
            const barWidth = 60;
            
            const h = (barData[i] || 0) * 1.5; // Scale to 150 max height
            
            return (
              <rect 
                key={i} 
                x={x - barWidth/2} 
                y={200 - h - 30} 
                width={barWidth} 
                height={h} 
                fill={`url(#grad-${chartId})`}
                rx="4"
                className="transition-all duration-500"
              />
            );
          })}
          
          {/* Line 1 */}
          {(type === 'bar-line' || type === 'line') && lineData.length >= 2 && (
            <path 
              d={(() => {
                const chartAreaWidth = 800;
                const step = chartAreaWidth / (lineData.length - 1);
                return lineData.reduce((path, val, i) => {
                  const x = 100 + i * step;
                  const y = 200 - (val * 1.5) - 30;
                  return path + `${i === 0 ? 'M' : ' L'} ${x} ${y}`;
                }, "");
              })()}
              fill="none"
              stroke={secondaryColor}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={`url(#glow-${chartId})`}
              className="drop-shadow-lg"
            />
          )}

          {/* Line 2 (Optional) */}
          {(type === 'bar-line' || type === 'line') && line2Data && line2Data.length >= 2 && (
            <path 
              d={(() => {
                const chartAreaWidth = 800;
                const step = chartAreaWidth / (line2Data.length - 1);
                return line2Data.reduce((path, val, i) => {
                  const x = 100 + i * step;
                  const y = 200 - (val * 1.5) - 30;
                  return path + `${i === 0 ? 'M' : ' L'} ${x} ${y}`;
                }, "");
              })()}
              fill="none"
              stroke={line2Color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={`url(#glow-${chartId})`}
              className="drop-shadow-lg"
            />
          )}

          {/* Y Labels - Left */}
          {yLeftLabels.map((label, i) => (
            <text 
              key={i} 
              x="35" 
              y={55 + i * 50} 
              fill="#64748b" 
              fontSize="12" 
              fontWeight="500"
              textAnchor="end"
              className="font-sans"
            >
              {label}
            </text>
          ))}
          
          {/* Y Labels - Right */}
          {yRightLabels.map((label, i) => (
            <text 
              key={i} 
              x="965" 
              y={55 + i * 50} 
              fill="#64748b" 
              fontSize="12" 
              fontWeight="500"
              textAnchor="start"
              className="font-sans"
            >
              {label}
            </text>
          ))}
          
          {/* X Labels */}
          {xLabels.map((label, i) => {
            const itemCount = xLabels.length;
            const chartAreaWidth = 800;
            const step = chartAreaWidth / Math.max(1, itemCount - 1);
            const x = 100 + i * step;
            return (
              <text 
                key={i} 
                x={x} 
                y="195" 
                fill="#64748b" 
                fontSize="12" 
                fontWeight="600"
                textAnchor="middle"
                className="font-sans"
              >
                {label}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
