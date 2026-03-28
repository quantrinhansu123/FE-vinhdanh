import React from 'react';
import { ChevronDown } from 'lucide-react';

interface SecondaryMetric {
  label: string;
  value: string;
  percentage: number;
  color: string;
  align?: 'left' | 'right';
  isReverse?: boolean;
}

interface MetricCardProps {
  title: string;
  status: {
    value: string;
    isPositive: boolean;
  };
  mainMetric: {
    label: string;
    value: string;
  };
  secondaryMetrics: SecondaryMetric[];
  borderColor?: string;
  children?: React.ReactNode;
  headerIcon?: React.ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  status,
  mainMetric,
  secondaryMetrics,
  borderColor = 'border-emerald-600',
  children,
  headerIcon
}) => {
  return (
    <div className={`bg-ads-card rounded-xl p-3 border-t-4 ${borderColor} flex flex-col min-w-[320px] lg:flex-1 flex-shrink-0`}>
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="text-xs uppercase text-gray-400 font-bold">{title}</div>
            {headerIcon && <div className="w-12 h-12 relative">{headerIcon}</div>}
          </div>
          <div className={`text-[10px] ${status.isPositive ? 'text-emerald-500 bg-emerald-900/30' : 'text-red-500 bg-red-900/30'} w-fit px-2 py-0.5 rounded flex items-center`}>
            {!status.isPositive && <ChevronDown className="w-2 h-2 mr-1" />}
            {status.value}
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-gray-500">{mainMetric.label}</span>
          <span className="text-3xl font-bold">{mainMetric.value}</span>
        </div>
      </div>

      <div className="mb-2">
        <div className="flex items-start justify-between gap-3">
          {secondaryMetrics.map((metric, idx) => (
            <div key={idx} className={`flex-1 min-w-0 ${metric.align === 'right' ? 'text-right' : ''}`}>
              <div className="text-[10px] text-gray-400 mb-0.5">{metric.label}</div>
              <div className="text-base font-semibold mb-1">{metric.value}</div>
              <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${metric.color} rounded-full ${metric.align === 'right' ? 'ml-auto' : ''}`}
                  style={{ width: `${Math.min(100, metric.percentage)}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {children && <div className="mt-auto flex gap-2">{children}</div>}
    </div>
  );
};
