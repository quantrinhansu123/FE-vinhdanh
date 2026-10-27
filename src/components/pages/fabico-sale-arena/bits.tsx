import { useState, type ReactNode } from 'react';
import { ASSET_BASE, type SaleRow } from './dashboardData';

const FALLBACK = `${ASSET_BASE}/avatar-default.svg`;

function resolveAvatar(url?: string) {
  if (!url) return FALLBACK;
  if (url.startsWith('/')) return url;
  if (url.startsWith('assets/')) return `${ASSET_BASE}/${url.slice('assets/'.length)}`;
  try {
    const parsed = new URL(url, window.location.href);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.href;
  } catch {
    return FALLBACK;
  }
  return FALLBACK;
}

export function SaleAvatar({ sale, className = 'tiny-avatar' }: { sale: SaleRow; className?: string }) {
  const [failed, setFailed] = useState(false);
  const crop = sale.avatarCrop;
  const src = failed ? FALLBACK : resolveAvatar(sale.avatar);
  const cropped = !failed && crop && [crop.x, crop.y, crop.size].every(Number.isFinite) && crop.size > 0;

  if (cropped && crop) {
    return (
      <span className={`${className} crop-avatar`} role="img" aria-label={sale.name}>
        <img
          src={src}
          alt=""
          style={{
            width: `${(897 / crop.size) * 100}%`,
            left: `${(-crop.x / crop.size) * 100}%`,
            top: `${(-crop.y / crop.size) * 100}%`,
          }}
          onError={() => setFailed(true)}
        />
      </span>
    );
  }

  return <img className={className} src={src} alt={sale.name} onError={() => setFailed(true)} />;
}

export function Spark({
  values,
  color = '#38caff',
  area = false,
  className = 'mini-spark',
}: {
  values: number[] | undefined;
  color?: string;
  area?: boolean;
  className?: string;
}) {
  const series = values && values.length > 1 ? values : [0, 0];
  const min = Math.min(...series);
  const range = Math.max(...series) - min || 1;
  const points = series.map((value, index) => `${(index / (series.length - 1)) * 100},${27 - ((value - min) / range) * 23}`).join(' ');
  const last = series[series.length - 1];

  return (
    <svg className={className} viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden>
      {area ? <polygon points={`0,32 ${points} 100,32`} fill={color} opacity={0.12} /> : null}
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.3} vectorEffect="non-scaling-stroke" />
      <circle cx={100} cy={27 - ((last - min) / range) * 23} r={1.4} fill={color} />
    </svg>
  );
}

export function Bars({ color }: { color: string }) {
  const heights = [16, 26, 14, 32, 20, 38, 18, 30, 22, 42, 16, 34, 20, 28, 14, 36, 22, 32, 18, 40, 15, 26, 20, 34, 13, 30, 22, 38, 18];
  return (
    <svg className="kpi-chart kpi-bars" viewBox="0 0 220 48" preserveAspectRatio="none" aria-hidden>
      {heights.map((height, index) => (
        <rect key={index} x={index * 7.45} y={48 - height} width="3.5" height={height} rx="1.2" fill={color} opacity={0.78 + (index % 3) * 0.07} />
      ))}
    </svg>
  );
}

export function KpiMark({ index }: { index: number }) {
  if (index === 1) {
    return (
      <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden>
        <ellipse cx="12" cy="17" rx="6.4" ry="2.15" fill="currentColor" opacity="0.38" />
        <ellipse cx="12" cy="13.6" rx="6.4" ry="2.15" fill="currentColor" opacity="0.62" />
        <ellipse cx="12" cy="10.2" rx="6.4" ry="2.15" fill="currentColor" />
        <path d="M8.2 9.4c.7-.7 2.1-1.1 3.8-1.1s3.1.4 3.8 1.1" fill="none" stroke="#fff4c4" strokeWidth="1" strokeLinecap="round" opacity="0.8" />
      </svg>
    );
  }
  if (index === 2) return <TargetIcon />;
  if (index === 3) {
    return (
      <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden>
        <circle cx="9" cy="8.1" r="2.5" fill="currentColor" />
        <circle cx="15.6" cy="9" r="2" fill="currentColor" opacity="0.72" />
        <path d="M3.6 18.6c.5-3.1 2.6-4.8 5.4-4.8s4.9 1.7 5.4 4.8" fill="currentColor" />
        <path d="M14.4 14.3c1.6.3 2.8 1.3 3.4 3.1" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  if (index === 4) {
    return (
      <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden>
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 8.2 16 15.8M16 8.2 8 15.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (index === 5) {
    return (
      <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden>
        <path d="M6 3.4v17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M6.8 4.2h11.4L15.6 7.6l2.6 3.4H6.8z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden>
      <circle cx="12" cy="12" r="8.1" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 7.1v9.8M14.7 8.6c-.5-.6-1.4-.9-2.5-.9-1.5 0-2.5.7-2.5 1.7 0 1 .7 1.5 2.3 1.9l.7.2c1.2.3 1.7.7 1.7 1.5 0 1-1 1.7-2.5 1.7-1.1 0-2-.3-2.6-.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden>
      {children}
    </svg>
  );
}

export function TrophyIcon() {
  return (
    <Glyph>
      <path fill="currentColor" d="M7.1 3.1h9.8v2.4c0 3.1-2 5.1-4.9 5.3-2.9-.2-4.9-2.2-4.9-5.3V3.1z" />
      <path fill="currentColor" d="M7.1 4.3H4.2c.15 2.35 1.45 3.7 3.2 4.05V6.2C6.1 5.85 5.6 5.15 5.5 4.3H7.1zM16.9 4.3h2.9c-.15 2.35-1.45 3.7-3.2 4.05V6.2c1.3-.35 1.8-1.05 1.9-1.9H16.9z" />
      <path fill="currentColor" d="M10.7 11h2.6v2.2h-2.6z" />
      <path fill="currentColor" d="M8.3 13.4h7.4v1.45c0 .55-.5 1-1.15 1H9.45c-.65 0-1.15-.45-1.15-1V13.4z" />
      <path fill="currentColor" d="M6.6 16.2h10.8v1.9H6.6z" />
    </Glyph>
  );
}

export function ChartIcon({ variant = 'peak' }: { variant?: 'peak' | 'rise' }) {
  const bars = variant === 'rise'
    ? [
        { x: 3.2, y: 13.2, h: 6.6, o: 0.72 },
        { x: 9.9, y: 8.4, h: 11.4, o: 0.88 },
        { x: 16.6, y: 3.6, h: 16.2, o: 1 },
      ]
    : [
        { x: 3.2, y: 10.2, h: 9.6, o: 0.7 },
        { x: 9.9, y: 3.6, h: 16.2, o: 1 },
        { x: 16.6, y: 7.4, h: 12.4, o: 0.86 },
      ];
  return (
    <Glyph>
      {bars.map((bar) => (
        <rect key={bar.x} x={bar.x} y={bar.y} width="4.2" height={bar.h} rx="1" fill="currentColor" opacity={bar.o} />
      ))}
    </Glyph>
  );
}

export function TargetIcon() {
  return (
    <Glyph>
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" />
    </Glyph>
  );
}

export function TrendIcon() {
  return (
    <Glyph>
      <path d="M4 16.5 9 11l3.2 3.2L20 6.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 6.5h6v6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Glyph>
  );
}

export function ShieldIcon() {
  return (
    <Glyph>
      <path fill="currentColor" d="M12 2.4 20.2 6v6.4c0 4.5-3.1 7.6-8.2 9.3C6.9 20 3.8 16.9 3.8 12.4V6L12 2.4z" />
      <path d="M8.3 12.1 11 14.8l4.8-5.1" fill="none" stroke="#062033" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Glyph>
  );
}

export function RankBadge({ rank }: { rank: number }) {
  if (rank > 3) return rank;
  const tone = rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'gold';
  const face = {
    gold: { fill: '#ffe14a', ear: '#f0c043', ink: '#6a4a10' },
    silver: { fill: '#e8eef6', ear: '#c5d0de', ink: '#3a4b5e' },
    bronze: { fill: '#f09448', ear: '#d87430', ink: '#5c2e14' },
  }[tone];
  return (
    <span className={`rank-badge ${tone === 'gold' ? '' : tone}`}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
        <path d="M7.4 10.6 5.1 4.2 11.2 8.4Z" fill={face.ear} />
        <path d="M16.6 10.6 18.9 4.2 12.8 8.4Z" fill={face.ear} />
        <circle cx="12" cy="13.6" r="7.2" fill={face.fill} />
        <text
          x="12"
          y="13.6"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="9"
          fontWeight="800"
          fill={face.ink}
          fontFamily="Arial, Helvetica, sans-serif"
        >
          {rank}
        </text>
      </svg>
    </span>
  );
}
