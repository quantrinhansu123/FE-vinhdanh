import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Trash2, X } from 'lucide-react';
import { Badge } from '../../../components/crm-dashboard/atoms/SharedAtoms';
import type { Employee } from '../../../types';

function formatDateVn(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function workDaysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso.slice(0, 10));
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const ms = today.getTime() - d.getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function displayMaNs(row: Employee): string {
  const m = row.ma_ns?.trim();
  if (m) return m;
  return row.id.slice(0, 8).toUpperCase();
}

function trangThaiCell(tt: string | null | undefined): React.ReactNode {
  switch (tt) {
    case 'dang_lam':
      return <Badge type="G">Đang làm</Badge>;
    case 'nghi':
      return <Badge type="default">Nghỉ</Badge>;
    case 'tam_nghi':
      return <Badge type="Y">Tạm nghỉ</Badge>;
    case 'dot_tien':
      return (
        <span className="inline-flex items-center gap-[4px] p-[2.5px_8px] bg-[rgba(224,61,61,0.12)] text-[var(--R)] rounded-[4px] text-[9.5px] font-extrabold border border-[rgba(224,61,61,0.2)]">
          ⚠ Đốt tiền
        </span>
      );
    default:
      return <Badge type="default">{tt || '—'}</Badge>;
  }
}

const ROW_CLASS = 'flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-3 py-2.5 border-b border-[var(--border2)] last:border-0';
const LABEL_CLASS = 'text-[10px] font-bold uppercase tracking-wide text-[var(--text3)] shrink-0 sm:w-[140px]';
const VALUE_CLASS = 'text-[12px] text-[var(--text)] break-words min-w-0';

type Props = {
  open: boolean;
  row: Employee | null;
  onClose: () => void;
  onDelete?: (row: Employee) => void | Promise<void>;
  deleting?: boolean;
};

export const StaffDetailModal: React.FC<Props> = ({ open, row, onClose, onDelete, deleting }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !row) return null;

  const days = workDaysSince(row.ngay_bat_dau);
  const fp = row.so_fanpage ?? 0;

  return createPortal(
    <div className="dash-theme project-form-modal-root fixed inset-0 z-[10050] !bg-transparent font-[family-name:var(--f)]">
      <div className="absolute inset-0 z-0 bg-black/60 backdrop-blur-[3px]" aria-hidden onMouseDown={onClose} />
      <div className="pointer-events-none relative z-[1] flex min-h-[100dvh] w-full items-center justify-center p-4 sm:p-6">
        <div
          className="project-form-modal-scroll pointer-events-auto w-full max-w-[480px] max-h-[min(90dvh,calc(100svh-2rem))] overflow-y-auto overflow-x-hidden rounded-[var(--r)] border border-[var(--border2)] bg-[var(--bg1)] text-[var(--text)] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="staff-detail-title"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-[14px_16px] border-b border-[var(--border2)] shrink-0 bg-[var(--bg1)]">
            <h2 id="staff-detail-title" className="text-[13px] font-extrabold text-[var(--text)]">
              Chi tiết nhân sự
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-[6px] text-[var(--text2)] hover:bg-[var(--bg3)] hover:text-[var(--text)] transition-colors"
              aria-label="Đóng"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-[16px]">
            <div className={ROW_CLASS}>
              <span className={LABEL_CLASS}>Mã NS</span>
              <span className={`${VALUE_CLASS} font-bold text-[#3d8ef0]`}>{displayMaNs(row)}</span>
            </div>
            <div className={ROW_CLASS}>
              <span className={LABEL_CLASS}>Họ tên</span>
              <span className={`${VALUE_CLASS} font-extrabold text-[#fff]`}>
                <div className="flex items-center gap-[12px]">
                  <div className="w-[34px] h-[34px] rounded-full overflow-hidden bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.12)] shrink-0 flex items-center justify-center">
                    {row.avatar_url ? (
                      <img src={row.avatar_url} alt={`${row.name} avatar`} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[12px] font-extrabold text-[var(--text3)]">
                        {(row.name || '?').trim().slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="min-w-0 truncate">{row.name}</span>
                </div>
              </span>
            </div>
            <div className={ROW_CLASS}>
              <span className={LABEL_CLASS}>Email</span>
              <span className={VALUE_CLASS}>{row.email?.trim() || '—'}</span>
            </div>
            <div className={ROW_CLASS}>
              <span className={LABEL_CLASS}>Team</span>
              <span className={VALUE_CLASS}>{row.team}</span>
            </div>
            <div className={ROW_CLASS}>
              <span className={LABEL_CLASS}>Vị trí</span>
              <span className={VALUE_CLASS}>{row.vi_tri?.trim() || '—'}</span>
            </div>
            <div className={ROW_CLASS}>
              <span className={LABEL_CLASS}>Ngày bắt đầu</span>
              <span className={VALUE_CLASS}>{formatDateVn(row.ngay_bat_dau)}</span>
            </div>
            <div className={ROW_CLASS}>
              <span className={LABEL_CLASS}>Ngày làm việc</span>
              <span className={VALUE_CLASS}>{days != null ? `${days} ngày` : '—'}</span>
            </div>
            <div className={ROW_CLASS}>
              <span className={LABEL_CLASS}>Số fanpage</span>
              <span className={VALUE_CLASS}>{fp}</span>
            </div>
            <div className={ROW_CLASS}>
              <span className={LABEL_CLASS}>Điểm (score)</span>
              <span className={`${VALUE_CLASS} tabular-nums`}>{row.score ?? 0}</span>
            </div>
            <div className={ROW_CLASS}>
              <span className={LABEL_CLASS}>Trạng thái</span>
              <div className={VALUE_CLASS}>{trangThaiCell(row.trang_thai)}</div>
            </div>
            <div className={ROW_CLASS}>
              <span className={LABEL_CLASS}>ID</span>
              <span className={`${VALUE_CLASS} font-mono text-[10px] text-[var(--text3)]`}>{row.id}</span>
            </div>
          </div>

          <div className="p-[12px_16px] border-t border-[var(--border2)] flex flex-wrap items-center justify-between gap-2">
            {onDelete ? (
              <button
                type="button"
                onClick={() => void onDelete(row)}
                disabled={deleting}
                className="inline-flex items-center gap-2 py-[8px] px-[14px] rounded-[6px] text-[11px] font-bold border border-[rgba(224,61,61,0.35)] bg-[rgba(224,61,61,0.1)] text-[var(--R)] hover:bg-[rgba(224,61,61,0.2)] transition-colors disabled:opacity-50"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} strokeWidth={2.25} />}
                Xoá nhân sự
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={onClose}
              className="py-[8px] px-[14px] rounded-[6px] text-[11px] font-bold bg-[var(--bg3)] text-[var(--text2)] hover:bg-[var(--bg2)] border border-[var(--border)] transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
