import React from 'react';
import { LucideIcon } from 'lucide-react';

interface SummaryMetric {
  label: string;
  value: string;
  color?: string;
  isBold?: boolean;
}

interface DashboardSummaryCardProps {
  title: string;
  metrics: SummaryMetric[];
  borderColor?: string;
  icon?: LucideIcon;
  iconColor?: string;
}

export const DashboardSummaryCard: React.FC<DashboardSummaryCardProps> = ({
  title,
  metrics,
  borderColor = 'border-emerald-900/10',
  icon: Icon,
  iconColor = 'text-emerald-500'
}) => {
  return (
    <div className={`bg-ads-card/40 backdrop-blur-sm rounded-2xl p-6 flex flex-col border ${borderColor} hover:border-emerald-500/30 transition-all duration-300 group`}>
      <div className="flex justify-between items-start mb-6">
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{title}</h4>
        {Icon && (
          <div className={`p-2 rounded-lg bg-emerald-500/10 ${iconColor} group-hover:scale-110 transition-transform`}>
            <Icon size={18} />
          </div>
        )}
      </div>
      
      <div className="space-y-4">
        {metrics.map((metric, idx) => (
          <div key={idx} className={`flex flex-col ${idx === 0 ? 'pb-2 border-b border-white/5' : ''}`}>
            <span className="text-[10px] text-gray-500 uppercase font-medium mb-1">{metric.label}</span>
            <span className={`${idx === 0 ? 'text-2xl' : 'text-lg'} font-bold ${metric.color || 'text-white'} tracking-tight`}>
              {metric.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
