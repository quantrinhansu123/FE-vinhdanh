import React from 'react';

interface SectionCardProps {
  title: string;
  subtitle?: string;
  badge?: {
    text: string;
    type?: 'G' | 'R' | 'Y' | 'B' | 'P';
  };
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyPadding?: boolean;
}

export const SectionCard: React.FC<SectionCardProps> = ({ 
  title, 
  subtitle, 
  badge, 
  actions, 
  children, 
  className = '',
  bodyPadding = true
}) => {
  return (
    <div className={`bg-[var(--bg2)] border border-[var(--border)] rounded-[var(--r)] overflow-hidden flex flex-col ${className}`}>
      <div className="flex items-center justify-between gap-3 p-[12px_16px] border-b border-[var(--border)] shrink-0 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[8px] min-w-0">
            <span className="text-[12px] font-extrabold tracking-[0.2px] text-[var(--text)] truncate">
              {title}
            </span>
            {badge && (
              <span className={`inline-flex items-center gap-[3px] p-[2px_7px] rounded-[4px] text-[9.5px] font-bold tracking-[0.2px] bg-[var(--${badge.type}d)] text-[var(--${badge.type})]`}>
                {badge.text}
              </span>
            )}
          </div>
          {subtitle && (
            <div className="text-[10px] text-[var(--text3)] mt-[1px]">
              {subtitle}
            </div>
          )}
        </div>
        <div className="flex items-center gap-[6px] shrink-0">
          {actions}
        </div>
      </div>
      <div className={`flex-1 ${bodyPadding ? "p-[14px_16px]" : ""}`}>
        {children}
      </div>
    </div>
  );
};

interface AlertItemProps {
  title: string;
  description: string;
  statusText: string;
  statusType: 'R' | 'Y' | 'G';
  icon?: string;
}

export const AlertItem: React.FC<AlertItemProps> = ({ title, description, statusText, statusType, icon }) => {
  const typeClasses = {
    R: 'bg-[var(--Rd)] border-[rgba(224,61,61,0.18)]',
    Y: 'bg-[var(--Yd)] border-[rgba(232,160,32,0.18)]',
    G: 'bg-[var(--Gd)] border-[rgba(15,168,109,0.18)]',
  };

  const statusTypeClasses = {
    R: 'bg-[var(--Rb)] text-[var(--R)]',
    Y: 'bg-[var(--Yb)] text-[var(--Y)]',
    G: 'bg-[var(--Gb)] text-[var(--G)]',
  };

  return (
    <div className={`flex items-start gap-[10px] p-[10px_13px] rounded-[8px] border border-transparent transition-all duration-150 hover:border-[var(--border2)] ${typeClasses[statusType]}`}>
      <div className="text-[12px] shrink-0 mt-[1px]">{icon || (statusType === 'R' ? '🔴' : statusType === 'Y' ? '🟡' : '🟢')}</div>
      <div className="flex-1">
        <div className="text-[11.5px] font-bold text-[var(--text)]">{title}</div>
        <div className="text-[10px] text-[var(--text3)] mt-[2px]">{description}</div>
      </div>
      <div className={`text-[9px] font-bold p-[2px_8px] rounded-[4px] self-center shrink-0 ${statusTypeClasses[statusType]}`}>
        {statusText}
      </div>
    </div>
  );
};

interface BarRowProps {
  label: string;
  widthPercent: number;
  value: string | number;
  color?: string;
  percentSubLabel?: string;
}

export const BarRow: React.FC<BarRowProps> = ({ label, widthPercent, value, color = 'var(--accent)', percentSubLabel }) => {
  return (
    <div className="flex items-center gap-[9px] py-[8px] border-b border-[rgba(255,255,255,0.04)] last:border-0 grow">
      <div className="text-[10.5px] text-[var(--text2)] w-[110px] shrink-0 whitespace-nowrap overflow-hidden text-ellipsis">
        {label}
      </div>
      <div className="flex-1 h-[5px] bg-[rgba(255,255,255,0.05)] rounded-[3px] overflow-hidden">
        <div 
          className="h-full rounded-[3px] transition-all duration-[1100ms] cubic-bezier(0.4,0,0.2,1)" 
          style={{ width: `${widthPercent}%`, background: color }} 
        />
      </div>
      <div className="font-[var(--mono)] text-[10.5px] font-bold text-[var(--text)] w-[75px] text-right shrink-0">
        {value}
      </div>
      {percentSubLabel && (
        <div className="text-[9.5px] text-[var(--text3)] w-[35px] text-right shrink-0">
          {percentSubLabel}
        </div>
      )}
    </div>
  );
};

interface ProgressRowProps {
  label: string;
  valueText: string;
  percent: number;
  color?: string;
  height?: number;
  subLabel?: string;
}

export const ProgressRow: React.FC<ProgressRowProps> = ({ 
  label, 
  valueText, 
  percent, 
  color = 'var(--accent)', 
  height = 4,
  subLabel 
}) => {
  return (
    <div className="mb-[10px] last:mb-0">
      <div className="flex justify-between mb-[5px]">
        <span className="text-[10.5px] text-[var(--text2)]">{label}</span>
        <span className="text-[10.5px] font-[var(--mono)]" style={{ color: color }}>{valueText}</span>
      </div>
      <div className="bg-[rgba(255,255,255,0.06)] rounded-[2px] overflow-hidden" style={{ height: `${height}px` }}>
        <div 
          className="h-full rounded-[2px] transition-all duration-[1100ms] cubic-bezier(0.4,0,0.2,1)" 
          style={{ width: `${percent}%`, background: color }} 
        />
      </div>
      {subLabel && (
        <div className="text-[9px] text-[var(--text3)] mt-[2px]">{subLabel}</div>
      )}
    </div>
  );
};

interface RankItemProps {
  rank: number | string;
  avatar: string;
  avatarBg?: string;
  name: string;
  team: string;
  value: string | number;
  badgeText?: string;
  badgeType?: 'G' | 'R' | 'Y' | 'B' | 'P';
  rankColor?: string;
  nameColor?: string;
  valueColor?: string;
}

export const RankItem: React.FC<RankItemProps> = ({ 
  rank, avatar, avatarBg, name, team, value, badgeText, badgeType, rankColor, nameColor, valueColor 
}) => {
  return (
    <div className="flex items-center gap-[10px] py-[9px] border-b border-[rgba(255,255,255,0.04)] last:border-0">
      <div className={`font-[var(--mono)] text-[11px] font-bold text-[var(--text3)] w-[18px] text-center shrink-0`} style={{ color: rankColor }}>
        {rank}
      </div>
      <div 
        className="w-[28px] h-[28px] rounded-full flex items-center justify-center text-[11px] font-extrabold text-[#fff] shrink-0" 
        style={{ background: avatarBg || 'linear-gradient(135deg, var(--accent), #5b4dff)' }}
      >
        {avatar}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11.5px] font-bold text-[var(--text)]" style={{ color: nameColor }}>{name}</div>
        <div className="text-[9.5px] text-[var(--text3)]">{team}</div>
      </div>
      <div className="font-[var(--mono)] text-[11.5px] font-bold shrink-0" style={{ color: valueColor || 'var(--text)' }}>
        {value}
      </div>
      {badgeText && (
        <span className={`ml-[6px] inline-flex items-center gap-[3px] p-[2px_7px] rounded-[4px] text-[9.5px] font-bold tracking-[0.2px] bg-[var(--${badgeType}d)] text-[var(--${badgeType})]`}>
          {badgeText}
        </span>
      )}
    </div>
  );
};

interface HeatCellProps {
  value: number | string;
  type: 'G' | 'Y' | 'R' | 'N';
}

export const HeatCell: React.FC<HeatCellProps> = ({ value, type }) => {
  const typeClasses = {
    G: 'bg-[var(--Gd)] text-[var(--G)]',
    Y: 'bg-[var(--Yd)] text-[var(--Y)]',
    R: 'bg-[var(--Rd)] text-[var(--R)]',
    N: 'bg-[var(--bg4)] text-[var(--text3)]',
  };
  return (
    <div className={`p-[5px_3px] rounded-[4px] text-[9.2px] font-bold text-center font-[var(--mono)] cursor-default transition-transform duration-100 min-w-[46px] hover:scale-[1.08] ${typeClasses[type]}`}>
      {value}
    </div>
  );
};

interface BudgetCardProps {
  id: string;
  agency: string;
  team: string;
  project: string;
  accounts: string;
  priority: string;
  date: string;
  amount: string;
  onApprove?: () => void;
  onReject?: () => void;
  onDetail?: () => void;
  isPending?: boolean;
}

export const BudgetCard: React.FC<BudgetCardProps> = ({ 
  id, agency, team, project, accounts, priority, date, amount, onApprove, onReject, onDetail, isPending 
}) => {
  const isHighPriority = priority === 'Cao';
  
  // Theme styling based on priority
  const themeClasses = isHighPriority 
    ? 'bg-[rgba(232,160,32,0.06)] border-[rgba(232,160,32,0.2)]'
    : 'bg-[rgba(61,142,240,0.06)] border-[rgba(61,142,240,0.2)]';

  const idColor = isHighPriority ? 'text-[var(--Y)]' : 'text-[var(--accent)]';

  return (
    <div className={`border rounded-[8px] p-[12px_14px] mb-[10px] flex items-center gap-[12px] transition-all hover:bg-opacity-80 ${themeClasses}`}>
      <div className="flex-1">
        <div className="text-[11.5px] font-bold text-[var(--text)]">
          <span className={`${idColor} font-black`}>{id}</span> · {agency} — {team} · {project}
        </div>
        <div className="text-[10px] text-[var(--text3)] mt-[3px]">Nạp TK: {accounts} · Ưu tiên: {priority} · {date}</div>
      </div>
      <div className={`font-[var(--mono)] text-[13px] font-black shrink-0 ${isHighPriority ? 'text-[var(--Y)]' : 'text-[#f5d908]'}`}>{amount}</div>
      <div className="flex gap-[8px] shrink-0">
        {onApprove && (
          <button onClick={onApprove} className="p-[5.5px_12px] text-[10.5px] font-bold rounded-[6px] transition-all bg-[rgba(15,168,109,0.12)] border border-[rgba(15,168,109,0.18)] text-[var(--G)] hover:bg-[rgba(15,168,109,0.18)]">
            ✓ Duyệt
          </button>
        )}
        {onReject && (
          <button onClick={onReject} className="p-[5.5px_12px] text-[10.5px] font-bold rounded-[6px] transition-all bg-[rgba(224,61,61,0.12)] border border-[rgba(224,61,61,0.18)] text-[var(--R)] hover:bg-[rgba(224,61,61,0.18)]">
            ✕ Từ chối
          </button>
        )}
        {onDetail && (
          <button onClick={onDetail} className="p-[5.5px_12px] text-[10.5px] font-black rounded-[6px] transition-all bg-[rgba(136,150,176,0.1)] border border-[rgba(136,150,176,0.15)] text-[var(--text2)] hover:bg-[rgba(136,150,176,0.15)]">
            Chi tiết
          </button>
        )}
      </div>
    </div>
  );
};

interface BadgeProps {
  children: React.ReactNode;
  type?: 'G' | 'R' | 'Y' | 'B' | 'P' | 'default';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, type = 'default', className = '' }) => {
  const typeClasses = {
    G: 'bg-[var(--Gd)] text-[var(--G)]',
    R: 'bg-[var(--Rd)] text-[var(--R)]',
    Y: 'bg-[var(--Yd)] text-[var(--Y)]',
    B: 'bg-[var(--accent-d)] text-[var(--accent)]',
    P: 'bg-[var(--Pd)] text-[var(--P)]',
    default: 'bg-[var(--bg3)] text-[var(--text2)]',
  };

  return (
    <span className={`inline-flex items-center gap-[3px] p-[2px_7px] rounded-[4px] text-[9.5px] font-bold tracking-[0.2px] ${typeClasses[type]} ${className}`}>
      {children}
    </span>
  );
};

interface BillCardProps {
  name: string;
  team: string;
  date: string;
  workDay: number;
  lastUpdate: string;
  stats: {
    revenue: string;
    adsCost: string;
    mess: number;
    lead: number;
    orders: number;
  };
  performance: {
    adsRatio: string;
    closeRate: string;
    leadRate: string;
    aov: string;
    cpo: string;
    cpl: string;
    cpa: string;
  };
  indicator: {
    type: 'G' | 'Y' | 'R';
    text: string;
  };
}

export const BillCard: React.FC<BillCardProps> = ({ 
  name, team, date, workDay, lastUpdate, stats, performance, indicator 
}) => {
  const indicatorClasses = {
    G: 'bg-[#ecfdf5] border-[#a7f3d0] text-[#059669]',
    Y: 'bg-[#fefce8] border-[#fde68a] text-[#d97706]',
    R: 'bg-[#fff1f2] border-[#fecdd3] text-[#e11d48]',
  };

  const indicatorDot = indicator.type === 'G' ? '🟢' : indicator.type === 'Y' ? '🟡' : '🔴';

  return (
    <div className="bg-white border border-[#e2e8e5] rounded-2xl p-6 max-w-[440px] shadow-xs">
      <div className="text-center pb-4 border-b border-[#e2e8e5] mb-4">
        <div className="text-[10px] font-extrabold tracking-[2.5px] uppercase text-[#006e51] mb-1.5">
          Marketing Performance Today
        </div>
        <div className="text-xl font-extrabold text-[#191c1b]">
          {name}
        </div>
        <div className="text-xs text-[#476355] mt-1">
          {team} · Ngày làm việc: {workDay}
        </div>
        <div className="text-[11px] text-[#8b9b94] mt-0.5">
          {date} · Cập nhật cuối: {lastUpdate}
        </div>
      </div>

      <div className="text-[10px] font-extrabold tracking-wider uppercase text-[#8b9b94] my-3">
        Thông tin cơ bản
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between py-2 border-b border-[#e2e8e5]">
          <span className="text-xs text-[#476355]">Doanh số</span>
          <span className="font-mono text-sm font-black text-[#006e51]">{stats.revenue} đ</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-[#e2e8e5]">
          <span className="text-xs text-[#476355]">Chi phí Ads</span>
          <span className="font-mono text-sm font-black text-[#191c1b]">{stats.adsCost} đ</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-[#e2e8e5]">
          <span className="text-xs text-[#476355]">Số lượng mess</span>
          <span className="font-mono text-sm font-bold text-[#191c1b]">{stats.mess}</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-[#e2e8e5]">
          <span className="text-xs text-[#476355]">Số lượng lead</span>
          <span className="font-mono text-sm font-bold text-[#191c1b]">{stats.lead}</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-[#e2e8e5]">
          <span className="text-xs text-[#476355]">Số lượng đơn</span>
          <span className="font-mono text-sm font-bold text-[#191c1b]">{stats.orders}</span>
        </div>
      </div>

      <div className="text-[10px] font-extrabold tracking-wider uppercase text-[#8b9b94] my-3 pt-2">
        Chỉ số hiệu suất
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between py-2 border-b border-[#e2e8e5]">
          <span className="text-xs text-[#476355]">% Ads / Doanh số</span>
          <span className="font-mono text-sm font-black text-[#006e51]">{performance.adsRatio}</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-[#e2e8e5]">
          <span className="text-xs text-[#476355]">Tỷ lệ chốt</span>
          <span className="font-mono text-sm font-black text-[#006e51]">{performance.closeRate}</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-[#e2e8e5]">
          <span className="text-xs text-[#476355]">Tỷ lệ xin số</span>
          <span className="font-mono text-sm font-bold text-[#191c1b]">{performance.leadRate}</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-[#e2e8e5]">
          <span className="text-xs text-[#476355]">AOV (Giá trị TB đơn)</span>
          <span className="font-mono text-sm font-black text-[#191c1b]">{performance.aov} đ</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-[#e2e8e5]">
          <span className="text-xs text-[#476355]">CPO (Chi phí / đơn)</span>
          <span className="font-mono text-sm font-black text-[#191c1b]">{performance.cpo} đ</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-[#e2e8e5]">
          <span className="text-xs text-[#476355]">CPL (Chi phí / lead)</span>
          <span className="font-mono text-sm font-black text-[#191c1b]">{performance.cpl} đ</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-[#e2e8e5]">
          <span className="text-xs text-[#476355]">CPA (Chi phí / mess)</span>
          <span className="font-mono text-sm font-black text-[#191c1b]">{performance.cpa} đ</span>
        </div>
      </div>

      <div className={`mt-4 p-3 rounded-xl text-xs font-bold flex items-center gap-2 border ${indicatorClasses[indicator.type]}`}>
        {indicatorDot} {indicator.text}
      </div>

      <div className="mt-5 flex gap-2.5">
        <button type="button" onClick={() => window.print()} className="flex-1 justify-center py-2.5 rounded-xl text-xs font-bold bg-[#f8faf9] text-[#191c1b] border border-[#e2e8e5] hover:bg-[#f0f4f1] transition-all">⬇ Tải PNG</button>
        <button type="button" onClick={() => window.print()} className="flex-1 justify-center py-2.5 rounded-xl text-xs font-bold bg-[#006e51] text-white shadow-xs hover:bg-[#005840] transition-all flex items-center justify-center gap-1.5"><span className="text-sm">📄</span> Tải PDF</button>
      </div>
    </div>
  );
};
