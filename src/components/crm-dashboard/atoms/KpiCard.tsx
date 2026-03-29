import React from 'react';
import { motion } from 'motion/react';

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  delta?: string;
  deltaType?: 'up' | 'dn' | 'nt';
  icon?: string;
  barColor?: string;
  animationDelay?: number;
  valueSize?: 'lg' | 'xl' | 'default';
  valueColor?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  sub,
  delta,
  deltaType,
  icon,
  barColor,
  animationDelay = 0,
  valueSize = 'default',
  valueColor
}) => {
  const deltaClass = deltaType === 'up' ? 'text-[var(--G)]' : deltaType === 'dn' ? 'text-[var(--R)]' : 'text-[var(--Y)]';
  const deltaIcon = deltaType === 'up' ? '▲' : deltaType === 'dn' ? '▼' : '●';

  const valueClasses = `font-[var(--mono)] font-bold leading-tight ${
    valueSize === 'lg' ? 'text-base' : valueSize === 'xl' ? 'text-[22px]' : 'text-[20px]'
  }`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: animationDelay, duration: 0.35 }}
      style={{ border: '1px solid var(--border)' }}
      className="bg-[var(--bg2)] rounded-[var(--r)] p-[14px_16px] relative overflow-hidden transition-all duration-200 hover:border-[var(--border2)] hover:-translate-y-px"
    >
      {barColor && (
        <div 
          className="absolute top-0 left-0 right-0 h-[2px]" 
          style={{ background: barColor }} 
        />
      )}
      
      {icon && (
        <div className="absolute top-[12px] right-[12px] text-[18px] opacity-15">
          {icon}
        </div>
      )}

      <div className="text-[9.5px] font-bold tracking-[0.8px] uppercase text-[var(--text3)] mb-[8px]">
        {label}
      </div>

      <div className={valueClasses} style={{ color: valueColor || 'var(--text)' }}>
        {value}
      </div>

      {sub && (
        <div className="text-[9.5px] text-[var(--text3)] mt-[4px]">
          {sub}
        </div>
      )}

      {delta && (
        <div className={`text-[10px] font-bold mt-[7px] flex items-center gap-[3px] ${deltaClass}`}>
          {deltaIcon} {delta}
        </div>
      )}
    </motion.div>
  );
};
