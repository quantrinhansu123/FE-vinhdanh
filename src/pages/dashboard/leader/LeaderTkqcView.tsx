import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Loader2, RefreshCw, Upload } from 'lucide-react';
import { SectionCard } from '../../../components/crm-dashboard/atoms/SharedAtoms';
import { supabase } from '../../../api/supabase';
import type { AuthUser, DuAnQcExcelRow } from '../../../types';
import { formatFullVnd, formatReportDateVi } from '../mkt/mktDetailReportShared';
import { QC_EXCEL_TABLE, downloadQcExcelTemplate, parseQcExcelFile } from '../admin/projectQcExcel';

type QcRow = DuAnQcExcelRow;

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

export type LeaderTkqcViewProps = { viewer?: AuthUser | null };

export const LeaderTkqcView: React.FC<LeaderTkqcViewProps> = ({ viewer = null }) => {
  const defaultTo = toYmd(new Date());
  const defaultFrom = toYmd(addDays(new Date(), -90));
  const [draftFrom, setDraftFrom] = useState(defaultFrom);
  const [draftTo, setDraftTo] = useState(defaultTo);
  const [applied, setApplied] = useState({ from: defaultFrom, to: defaultTo });
  const [rows, setRows] = useState<QcRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [excelBusy, setExcelBusy] = useState(false);
  const [excelMsg, setExcelMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const leaderCode = viewer?.ma_ns?.trim() || '';

  const load = useCallback(async () => {
    if (!viewer?.email?.trim() || !leaderCode) {
      setRows([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase
      .from(QC_EXCEL_TABLE)
      .select('id, ma_nv, ngay, ten_chien_dich, so_tien_da_chi_tieu_vnd, so_tro_chuyen_tin_nhan, source_file, created_at')
      .eq('ma_nv', leaderCode)
      .gte('ngay', applied.from)
      .lte('ngay', applied.to)
      .not('ten_chien_dich', 'ilike', 'all')
      .order('ngay', { ascending: false, nullsFirst: true })
      .order('created_at', { ascending: false })
      .limit(800);
    if (qErr) {
      console.error('leader-tkqc:', qErr);
      setError(qErr.message?.includes('does not exist') || qErr.message?.includes('schema cache')
        ? `${qErr.message} \u2014 Ch\u1ea1y supabase/create_du_an_qc_excel.sql.`
        : qErr.message || 'Kh\u00f4ng t\u1ea3i \u0111\u01b0\u1ee3c d\u1eef li\u1ec7u.');
      setRows([]);
    } else {
      setRows((data || []) as QcRow[]);
    }
    setLoading(false);
  }, [viewer?.email, leaderCode, applied, refreshNonce]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!excelMsg) return;
    const timer = window.setTimeout(() => setExcelMsg(null), 5000);
    return () => window.clearTimeout(timer);
  }, [excelMsg]);

  const applyFilters = () => setApplied({ from: draftFrom, to: draftTo });
  const handleDownloadTemplate = () => {
    setExcelMsg(null);
    downloadQcExcelTemplate();
    setExcelMsg('\u0110\u00e3 t\u1ea3i m\u1eabu Excel. M\u00e3 NV c\u00f3 th\u1ec3 \u0111i\u1ec1n ri\u00eang ho\u1eb7c t\u1ef1 t\u00e1ch t\u1eeb t\u00ean chi\u1ebfn d\u1ecbch.');
  };

  const handleExcelUpload = async (file: File | null) => {
    setExcelMsg(null);
    if (!file?.name) return;
    if (!leaderCode) {
      window.alert('T\u00e0i kho\u1ea3n ch\u01b0a c\u00f3 M\u00e3 NV trong h\u1ed3 s\u01a1 nh\u00e2n s\u1ef1.');
      return;
    }
    setExcelBusy(true);
    try {
      const { rows: parsed, errors } = await parseQcExcelFile(file);
      if (errors.length) {
        window.alert(errors.slice(0, 15).map((e) => `D\u00f2ng ${e.row}: ${e.msg}`).join('\n'));
        return;
      }
      if (!parsed.length) {
        window.alert('Kh\u00f4ng c\u00f3 d\u00f2ng h\u1ee3p l\u1ec7.');
        return;
      }
      const payloads = parsed.map((row) => ({
        ...row,
        ma_nv: row.ma_nv || leaderCode,
        source_file: file.name.slice(0, 240),
      }));
      const wrongCode = payloads.find((row) => row.ma_nv?.toLowerCase() !== leaderCode.toLowerCase());
      if (wrongCode) {
        window.alert(`File c\u00f3 M\u00e3 NV ${wrongCode.ma_nv}, kh\u00f4ng kh\u1edbp M\u00e3 NV c\u1ee7a t\u00e0i kho\u1ea3n (${leaderCode}).`);
        return;
      }
      if (!window.confirm(`Nh\u1eadp ${payloads.length} d\u00f2ng QC Excel cho M\u00e3 NV ${leaderCode}?`)) return;
      const { error: insertError } = await supabase.from(QC_EXCEL_TABLE).insert(payloads);
      if (insertError) throw insertError;
      setExcelMsg(`\u0110\u00e3 nh\u1eadp ${payloads.length} d\u00f2ng t\u1eeb \u201c${file.name}\u201d.`);
      setRefreshNonce((n) => n + 1);
    } catch (e) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as any).message) : 'Kh\u00f4ng nh\u1eadp \u0111\u01b0\u1ee3c file Excel.';
      setExcelMsg(`L\u1ed7i: ${msg}`);
      window.alert(`L\u1ed7i ghi DB: ${msg}`);
    } finally {
      setExcelBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const summary = useMemo(() => {
    const code = leaderCode || 'Ch\u01b0a c\u00f3 M\u00e3 NV';
    return `${code} \u00b7 ${rows.length} d\u00f2ng \u00b7 ${applied.from} \u2192 ${applied.to}`;
  }, [leaderCode, rows.length, applied]);

  if (!viewer?.email?.trim()) {
    return <div className="dash-fade-up p-6 text-[12px] text-[var(--text3)] font-bold">Đăng nhập CRM để xem dữ liệu QC.</div>;
  }

  return (
    <div className="dash-fade-up">
      <SectionCard
        title="Quản lý QC Excel"
        subtitle={summary}
        bodyPadding={false}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setRefreshNonce((n) => n + 1)} disabled={loading}
              className="flex items-center gap-1.5 rounded-[6px] border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.06)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--text2)] disabled:opacity-50">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Làm mới
            </button>
            <button type="button" onClick={handleDownloadTemplate} disabled={excelBusy}
              className="flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--bg2)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--text2)] disabled:opacity-50">
              <Download size={13} /> Tải mẫu Excel
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={(e) => void handleExcelUpload(e.target.files?.[0] ?? null)} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={excelBusy || !leaderCode}
              className="flex items-center gap-1.5 rounded-[6px] border border-[#10b981] px-2.5 py-1.5 text-[11px] font-bold text-[#34d399] disabled:opacity-50">
              {excelBusy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Tải lên Excel
            </button>
          </div>
        }
      >
        <div className="p-[14px_16px] border-b border-[var(--border)] bg-[var(--bg3)] space-y-3">
          <p className="text-[10px] text-[var(--text3)] leading-relaxed max-w-[960px]">
            Dữ liệu được lọc theo Mã NV <strong className="text-[var(--text2)]">{leaderCode || 'Chưa khai báo'}</strong>.
            Cột Excel: Ngày, Mã NV, Tên chiến dịch, Số tiền đã chi tiêu (VND), Số trò chuyện qua tin nhắn.
          </p>
          {!leaderCode && <div className="text-[11px] font-bold text-[var(--Y)]">Tài khoản chưa có Mã NV trong hồ sơ nhân sự.</div>}
          {excelMsg && <div className="text-[11px] font-bold text-[var(--G)] bg-[rgba(16,185,129,0.08)] border border-[rgba(16,185,129,0.25)] rounded-[8px] px-3 py-2">{excelMsg}</div>}
          {error && <div className="text-[11px] font-bold text-[var(--R)]">{error}</div>}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex min-w-[160px] flex-col gap-1">
              <span className="text-[9px] font-extrabold uppercase text-[var(--text3)]">Mã NV</span>
              <span className="rounded-[8px] border border-[var(--border)] bg-[var(--bg2)] p-2 text-[12px] text-[var(--text)]">{leaderCode || 'Chưa khai báo'}</span>
            </div>
            <label className="flex flex-col gap-1 min-w-[130px]">
              <span className="text-[9px] font-extrabold uppercase text-[var(--text3)]">Từ ngày</span>
              <input type="date" value={draftFrom} onChange={(e) => setDraftFrom(e.target.value || defaultFrom)}
                className="bg-[var(--bg2)] border border-[var(--border)] rounded-[8px] text-[12px] font-[var(--mono)] p-2 text-[var(--text)]" />
            </label>
            <label className="flex flex-col gap-1 min-w-[130px]">
              <span className="text-[9px] font-extrabold uppercase text-[var(--text3)]">Đến ngày</span>
              <input type="date" value={draftTo} onChange={(e) => setDraftTo(e.target.value || defaultTo)}
                className="bg-[var(--bg2)] border border-[var(--border)] rounded-[8px] text-[12px] font-[var(--mono)] p-2 text-[var(--text)]" />
            </label>
            <button type="button" onClick={applyFilters} disabled={loading || !leaderCode}
              className="rounded-[8px] bg-[var(--accent)] text-white px-4 py-2 text-[11px] font-black uppercase disabled:opacity-50">Áp dụng</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          {loading && rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-[var(--text3)]"><Loader2 className="w-7 h-7 animate-spin opacity-60" /><span className="text-[12px] font-bold">Đang tải…</span></div>
          ) : (
            <table className="w-full border-collapse min-w-[900px] text-left">
              <thead><tr className="border-b border-[var(--border)] text-[9px] font-extrabold uppercase tracking-wide text-[var(--text3)]">
                <th className="p-2">Mã NV</th><th className="p-2">Ngày</th><th className="p-2 min-w-[220px]">Tên chiến dịch</th>
                <th className="p-2 text-right">Chi tiêu (VND)</th><th className="p-2 text-right">Trò chuyện</th><th className="p-2">File</th>
              </tr></thead>
              <tbody className="text-[11px] text-[var(--text2)] font-[var(--mono)]">
                {rows.length === 0 && !loading ? (
                  <tr><td colSpan={6} className="p-10 text-center text-[var(--text3)] font-bold">Chưa có dữ liệu QC trong khoảng ngày đã chọn.</td></tr>
                ) : rows.map((row) => (
                  <tr key={row.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)]">
                    <td className="p-2 font-bold text-[var(--text)]">{row.ma_nv || '—'}</td>
                    <td className="p-2 whitespace-nowrap">{row.ngay ? formatReportDateVi(row.ngay.slice(0, 10)) : '\u2014'}</td>
                    <td className="p-2 max-w-[300px] truncate" title={row.ten_chien_dich || ''}>{row.ten_chien_dich || '—'}</td>
                    <td className="p-2 text-right">{formatFullVnd(row.so_tien_da_chi_tieu_vnd)}</td>
                    <td className="p-2 text-right">{row.so_tro_chuyen_tin_nhan ?? '—'}</td>
                    <td className="p-2 max-w-[160px] truncate text-[10px]" title={row.source_file || ''}>{row.source_file || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </SectionCard>
    </div>
  );
};
