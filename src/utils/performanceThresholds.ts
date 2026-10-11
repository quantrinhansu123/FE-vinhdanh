export const ADS_WARNING_PERCENT = 33;
export const ADS_LIMIT_PERCENT = 36;
export const CLOSE_WARNING_PERCENT = 30;
export const CLOSE_GOOD_PERCENT = 35;

export type PerformanceTone = 'green' | 'amber' | 'red' | 'neutral';

export function adsTone(percent: number | null | undefined): PerformanceTone {
  if (percent == null || !Number.isFinite(percent)) return 'neutral';
  if (percent > ADS_LIMIT_PERCENT) return 'red';
  return percent >= ADS_WARNING_PERCENT ? 'amber' : 'green';
}

export function closeTone(percent: number | null | undefined): PerformanceTone {
  if (percent == null || !Number.isFinite(percent)) return 'neutral';
  if (percent < CLOSE_WARNING_PERCENT) return 'red';
  return percent > CLOSE_GOOD_PERCENT ? 'green' : 'amber';
}

export function performanceTextClass(tone: PerformanceTone): string {
  return `performance-text-${tone}`;
}

export function performancePillClass(tone: PerformanceTone): string {
  return `performance-pill performance-pill-${tone}`;
}

export const PERFORMANCE_COLORS: Record<PerformanceTone, string> = {
  green: '#059669',
  amber: '#ca8a04',
  red: '#e11d48',
  neutral: '#64748b',
};
