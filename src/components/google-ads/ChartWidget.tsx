import React from 'react';

interface ChartWidgetProps {
  title: string;
  children: React.ReactNode;
  minWidth?: number;
}

export const ChartWidget: React.FC<ChartWidgetProps> = ({
  title,
  children,
  minWidth = 450
}) => {
  return (
    <div className={`bg-ads-card rounded-lg p-4 min-w-[${minWidth}px] flex-shrink-0 flex flex-col border border-emerald-900/20`}>
      <h4 className="text-sm font-bold text-white mb-3">{title}</h4>
      {children}
    </div>
  );
};
