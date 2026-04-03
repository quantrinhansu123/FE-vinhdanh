import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Loader2, RefreshCw, Upload } from 'lucide-react';
import { SectionCard } from '../../../components/crm-dashboard/atoms/SharedAtoms';
import { supabase } from '../../../api/supabase';
import type { DuAnQcExcelRow, DuAnRow } from '../../../types';
import { formatCompactVnd, formatReportDateVi } from '../mkt/mktDetailReportShared';
import {
  QC_EXCEL_TABLE,
  downloadQcExcelTemplate,
  parseQcExcelFile,
} from './projectQcExcel';

const DU_AN_TABLE = import.meta.env.VITE_SUPABASE_DU_AN_TABLE?.trim() || 'du_an';

type DuAnEmbed = { ten_du_an?: string | null; ma_du_an?: string | null };

type RowWithProject = DuAnQcExcelRow & {
  du_an?: DuAnEmbed | DuAnEmbed[] | null;
};

function tenDuAnFromRow(r: RowWithProject): string {
  const v = r.du_an;
  if (!v) return '—';
  const o = Array.isArray(v) ? v[0] : v;
  return o?.ten_du_an?.trim() || '—';
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtTs(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('vi-VN');
}

export const ProjectQcExcelView: React.FC = () => {
  const defaultTo = toYmd(new Date());
  const defaultFrom = toYmd(addDays(new Date(), -90));

  const [projects, setProjects] = useState<DuAnRow[]>([]);
  const [draftDuAnId, setDraftDuAnId] = useState('');
  const [draftFrom, setDraftFrom] = useState(defaultFrom);
  const [draftTo, setDraftTo] = useState(defaultTo);
  const [applied, setApplied] = useState({ duAnId: '', from: defaultFrom, to: defaultTo });

  const [rows, setRows] = useState<RowWithProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [excelBusy, setExcelBusy] = useState(false);
  const [excelMsg, setExcelMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let c = false;
    void (async () => {
      const { data, error: e } = await supabase
        .from(DU_AN_TABLE)
        .select('id, ma_du_an, ten_du_an')
        .order('ten_du_an', { ascending: true });
      if (c) return;
      if (!e) setProjects((data || []) as DuAnRow[]);
    })();
    return () => {
      c = true;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    let q = supabase
      .from(QC_EXCEL_TABLE)
      .select(
        `id, du_an_id, ten_tai_khoan, ten_quang_cao, ngay, don_vi_tien_te,
         so_tien_chi_tieu_vnd, chi_phi_mua, cpm, ctr_tat_ca, luot_tro_chuyen_tin_nhan, cpc,
         bao_cao_tu, bao_cao_den, source_file, created_at,
         du_an ( ten_du_an, ma_du_an )`
      )
      .or(`ngay.is.null,and(ngay.gte.${applied.from},ngay.lte.${applied.to})`)
      .order('ngay', { ascending: false, nullsFirst: true })
      .order('created_at', { ascending: false })
      .limit(800);

    if (applied.duAnId) q = q.eq('du_an_id', applied.duAnId);

    const { data, error: qErr } = await q;
    if (qErr) {
      console.error('project-qc-excel:', qErr);
      setError(
        qErr.message?.includes('does not exist') || qErr.message?.includes('schema cache')
          ? `${qErr.message} — Chạy supabase/create_du_an_qc_excel.sql trong Supabase.`
          : qErr.message || 'Không tải được dữ liệu.'
      );
      setRows([]);
    } else {
      setRows((data || []) as RowWithProject[]);
    }
    setLoading(false);
  }, [applied]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyFilters = () => {
    setApplied({
      duAnId: draftDuAnId.trim(),
      from: draftFrom,
      to: draftTo,
    });
  };

  const uploadDuAnId = draftDuAnId.trim() || null;

  const handleUpload = async (file: File | null) => {
    setExcelMsg(null);
    if (!file?.name) return;
    setExcelBusy(true);
    try {
      const { rows: parsed, errors } = await parseQcExcelFile(file);
      if (errors.length) {
        window.alert(
          errors
            .slice(0, 15)
            .map((e) => `Dòng ${e.row}: ${e.msg}`)
            .join('\n') + (errors.length > 15 ? `\n… +${errors.length - 15}` : '')
        );
        return;
      }
      if (!parsed.length) {
        window.alert('Không có dòng hợp lệ.');
        return;
      }
      const duLabel = uploadDuAnId
        ? projects.find((p) => p.id === uploadDuAnId)?.ten_du_an || uploadDuAnId
        : '(chưa gán dự án)';
      if (!window.confirm(`Nhập ${parsed.length} dòng — gắn dự án: ${duLabel}?`)) return;

      const payloads = parsed.map((r) => ({
        ...r,
        du_an_id: uploadDuAnId,
        source_file: file.name.slice(0, 240),
      }));

      const chunk = 60;
      let done = 0;
      for (let i = 0; i < payloads.length; i += chunk) {
        const part = payloads.slice(i, i + chunk);
        const { error: insErr } = await supabase.from(QC_EXCEL_TABLE).insert(part);
        if (insErr) {
          console.error(insErr);
          window.alert(`Lỗi ghi DB (${done}/${parsed.length}): ${insErr.message}`);
          await load();
          return;
        }
        done += part.length;
      }
      setExcelMsg(`Đã nhập ${done} dòng từ «${file.name}».`);
      await load();
    } finally {
      setExcelBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const summary = useMemo(() => {
    if (!rows.length) return 'Chưa có dòng trong bộ lọc';
    return `${rows.length} dòng · ${applied.from} → ${applied.to}`;
  }, [rows.length, applied]);

  return (
    <div className="dash-fade-up">
      <SectionCard
        title="📊 Dữ liệu QC Excel (theo dự án)"
        subtitle={summary}
        bodyPadding={false}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-[6px] border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.06)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--text2)] hover:bg-[rgba(255,255,255,0.1)] disabled:opacity-50"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Làm mới
            </button>
            <button
              type="button"
              onClick={() => downloadQcExcelTemplate()}
              className="flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--bg2)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--text2)]"
            >
              <Download size={13} />
              Tải mẫu Excel
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => void handleUpload(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={excelBusy}
              className="flex items-center gap-1.5 rounded-[6px] border border-[#10b981] px-2.5 py-1.5 text-[11px] font-bold text-[#34d399] disabled:opacity-50"
            >
              {excelBusy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              Tải lên
            </button>
          </div>
        }
      >
        <div className="p-[14px_16px] border-b border-[var(--border)] bg-[var(--bg3)] space-y-3">
          <div className="flex flex-wrap gap-3 items-end">
            <label className="flex flex-col gap-1 min-w-[200px] flex-1 max-w-[320px]">
              <span className="text-[9px] font-extrabold uppercase text-[var(--text3)]">Dự án (khi nhập Excel)</span>
              <select
                value={draftDuAnId}
                onChange={(e) => setDraftDuAnId(e.target.value)}
                className="bg-[var(--bg2)] border border-[var(--border)] rounded-[8px] text-[12px] p-2 text-[var(--text)] outline-none focus:border-[var(--accent)] [color-scheme:dark]"
              >
                <option value="">— Chưa gán dự án —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.ma_du_an?.trim() ? `${p.ma_du_an} · ` : ''}
                    {p.ten_du_an}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 min-w-[130px]">
              <span className="text-[9px] font-extrabold uppercase text-[var(--text3)]">Từ ngày</span>
              <input
                type="date"
                value={draftFrom}
                onChange={(e) => setDraftFrom(e.target.value || defaultFrom)}
                className="bg-[var(--bg2)] border border-[var(--border)] rounded-[8px] text-[12px] font-[var(--mono)] p-2 text-[var(--text)]"
              />
            </label>
            <label className="flex flex-col gap-1 min-w-[130px]">
              <span className="text-[9px] font-extrabold uppercase text-[var(--text3)]">Đến ngày</span>
              <input
                type="date"
                value={draftTo}
                onChange={(e) => setDraftTo(e.target.value || defaultTo)}
                className="bg-[var(--bg2)] border border-[var(--border)] rounded-[8px] text-[12px] font-[var(--mono)] p-2 text-[var(--text)]"
              />
            </label>
            <button
              type="button"
              onClick={() => applyFilters()}
              disabled={loading}
              className="rounded-[8px] bg-[var(--accent)] text-white px-4 py-2 text-[11px] font-black uppercase disabled:opacity-50"
            >
              Áp dụng lọc
            </button>
          </div>
          <p className="text-[10px] text-[var(--text3)] leading-relaxed max-w-[1000px]">
            Giống export Meta: A tài khoản, B quảng cáo (ô trống = kế thừa dòng trên), C ngày hoặc «All» (tổng theo QC), D trống,
            E tiền tệ, F chi tiêu, G chi phí/lượt kết quả, H CPM, I CTR, J tin nhắn; tùy chọn K–M: CPC, bắt đầu/kết thúc báo cáo.
            Giữ hàng tiêu đề; file 10 cột vẫn hợp lệ.
            Bảng DB: <code className="text-[var(--text2)]">{QC_EXCEL_TABLE}</code>.
          </p>
          {excelMsg && (
            <div className="text-[11px] font-bold text-[var(--G)] bg-[rgba(16,185,129,0.08)] border border-[rgba(16,185,129,0.25)] rounded-[8px] px-3 py-2">
              {excelMsg}
            </div>
          )}
          {error && <div className="text-[11px] font-bold text-[var(--R)]">{error}</div>}
        </div>

        <div className="overflow-x-auto">
          {loading && rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-[var(--text3)]">
              <Loader2 className="w-7 h-7 animate-spin opacity-60" />
              <span className="text-[12px] font-bold">Đang tải…</span>
            </div>
          ) : (
            <table className="w-full border-collapse min-w-[1400px] text-left">
              <thead>
                <tr className="border-b border-[var(--border)] text-[9px] font-extrabold uppercase tracking-wide text-[var(--text3)]">
                  <th className="p-2 whitespace-nowrap">Dự án</th>
                  <th className="p-2 whitespace-nowrap">Ngày</th>
                  <th className="p-2 min-w-[120px]">Tài khoản</th>
                  <th className="p-2 min-w-[140px]">Quảng cáo</th>
                  <th className="p-2">Tiền tệ</th>
                  <th className="p-2 text-right">Chi tiêu</th>
                  <th className="p-2 text-right">CP mua</th>
                  <th className="p-2 text-right">CPM</th>
                  <th className="p-2 text-right">CTR</th>
                  <th className="p-2 text-right">TN</th>
                  <th className="p-2 text-right">CPC</th>
                  <th className="p-2 whitespace-nowrap">BC từ</th>
                  <th className="p-2 whitespace-nowrap">BC đến</th>
                  <th className="p-2">File</th>
                </tr>
              </thead>
              <tbody className="text-[11px] text-[var(--text2)] font-[var(--mono)]">
                {rows.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={14} className="p-10 text-center text-[var(--text3)] font-bold">
                      Không có dữ liệu — nhập Excel hoặc nới bộ lọc ngày.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const tenDa = tenDuAnFromRow(r);
                    const ngay = r.ngay?.slice(0, 10) || '';
                    return (
                      <tr
                        key={r.id}
                        className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)]"
                      >
                        <td className="p-2 max-w-[140px] truncate font-bold text-[var(--text)]" title={tenDa}>
                          {tenDa}
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          {ngay ? formatReportDateVi(ngay) : 'Tổng (All)'}
                        </td>
                        <td className="p-2 max-w-[140px] truncate" title={r.ten_tai_khoan || ''}>
                          {r.ten_tai_khoan || '—'}
                        </td>
                        <td className="p-2 max-w-[160px] truncate" title={r.ten_quang_cao || ''}>
                          {r.ten_quang_cao || '—'}
                        </td>
                        <td className="p-2">{r.don_vi_tien_te || '—'}</td>
                        <td className="p-2 text-right">{formatCompactVnd(r.so_tien_chi_tieu_vnd)}</td>
                        <td className="p-2 text-right">
                          {r.chi_phi_mua != null ? formatCompactVnd(r.chi_phi_mua) : '—'}
                        </td>
                        <td className="p-2 text-right">{r.cpm != null ? formatCompactVnd(r.cpm) : '—'}</td>
                        <td className="p-2 text-right text-[var(--text)]">{r.ctr_tat_ca || '—'}</td>
                        <td className="p-2 text-right">
                          {r.luot_tro_chuyen_tin_nhan != null ? String(r.luot_tro_chuyen_tin_nhan) : '—'}
                        </td>
                        <td className="p-2 text-right">{r.cpc != null ? formatCompactVnd(r.cpc) : '—'}</td>
                        <td className="p-2 text-[10px] text-[var(--text3)] whitespace-nowrap">{fmtTs(r.bao_cao_tu)}</td>
                        <td className="p-2 text-[10px] text-[var(--text3)] whitespace-nowrap">{fmtTs(r.bao_cao_den)}</td>
                        <td className="p-2 max-w-[100px] truncate text-[10px]" title={r.source_file || ''}>
                          {r.source_file || '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </SectionCard>
    </div>
  );
};
