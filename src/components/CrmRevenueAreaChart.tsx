import { useId } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCompactM, formatVnd } from './dashboardAdminUtils';

export type CrmRevenueAreaPoint = { label: string; revenue: number };

export function CrmRevenueAreaChart({
  series,
  emptyLabel = 'Không có dữ liệu doanh số trong khoảng này',
}: {
  series: CrmRevenueAreaPoint[];
  emptyLabel?: string;
}) {
  const data = series.map((p) => ({ name: p.label, revenue: p.revenue }));
  const fillId = `crmRevFill-${useId().replace(/:/g, '')}`;

  if (data.length === 0) {
    return (
      <div className="h-[280px] flex items-center justify-center text-crm-on-surface-variant text-sm">{emptyLabel}</div>
    );
  }

  return (
    <div className="h-[280px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 14, right: 10, left: 2, bottom: 6 }}>
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4ade80" stopOpacity={0.5} />
              <stop offset="45%" stopColor="#22c55e" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#15803d" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 10" stroke="rgba(45, 79, 62, 0.4)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: '#8ba899', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(45, 79, 62, 0.55)' }}
            interval="preserveStartEnd"
            minTickGap={10}
          />
          <YAxis
            tick={{ fill: '#8ba899', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatCompactM(Number(v))}
            width={52}
          />
          <Tooltip
            cursor={{ stroke: 'rgba(74, 222, 128, 0.45)', strokeWidth: 1 }}
            contentStyle={{
              background: 'color-mix(in srgb, var(--color-crm-surface-container) 96%, black)',
              border: '1px solid color-mix(in srgb, var(--color-crm-outline) 65%, transparent)',
              borderRadius: '12px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
            }}
            labelStyle={{ color: 'var(--color-crm-on-surface)', fontWeight: 700, fontSize: 12, marginBottom: 6 }}
            formatter={(value: number | undefined) => [formatVnd(value ?? 0), 'Doanh số']}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#4ade80"
            strokeWidth={2.5}
            fill={`url(#${fillId})`}
            activeDot={{ r: 6, strokeWidth: 2, stroke: '#14532d', fill: '#bbf7d0' }}
            dot={{ r: data.length <= 12 ? 4 : 0, strokeWidth: 2, stroke: '#14532d', fill: '#86efac' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
