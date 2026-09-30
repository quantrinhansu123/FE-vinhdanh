import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, Loader2, RefreshCw, Upload } from 'lucide-react';
import { SectionCard } from '../../../components/crm-dashboard/atoms/SharedAtoms';
import { supabase } from '../../../api/supabase';
import { fetchAllRows } from '../../../api/fetchAllRows';
import type { DuAnQcExcelRow } from '../../../types';
import { REPORTS_TABLE, formatFullVnd, formatReportDateVi, extractMaNvFromBracketPage } from '../mkt/mktDetailReportShared';
import {
  QC_EXCEL_TABLE,
  MKT_DAILY_DETAILS_TABLE,
  downloadQcExcelTemplate,
  parseQcExcelFile,
} from './projectQcExcel';

type RowWithCode = DuAnQcExcelRow;
const EMPLOYEES_TABLE = import.meta.env.VITE_SUPABASE_EMPLOYEES_TABLE?.trim() || 'employees';

function normalizeEmployeeCode(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\u00a0/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleUpperCase();
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


export const ProjectQcExcelView: React.FC = () => {
  const defaultTo = toYmd(new Date());
  const defaultFrom = toYmd(addDays(new Date(), -90));

  const [draftMaNv, setDraftMaNv] = useState('');
  const [draftFrom, setDraftFrom] = useState(defaultFrom);
  const [draftTo, setDraftTo] = useState(defaultTo);
  const [applied, setApplied] = useState({ maNv: '', from: defaultFrom, to: defaultTo });
  const loadVersion = useRef(0);
  const dailyLoadVersion = useRef(0);

  const [rows, setRows] = useState<RowWithCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [excelBusy, setExcelBusy] = useState(false);
  const [excelMsg, setExcelMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pushing, setPushing] = useState(false);
  const [dailyDetails, setDailyDetails] = useState<{
    id: string;
    report_date: string;
    ma_nv: string;
    ten_chien_dich: string;
    ad_cost_vnd: number;
    message_conversations: number;
    source_file: string | null;
  }[]>([]);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [dailyError, setDailyError] = useState<string | null>(null);
  const loadDailyDetails = useCallback(async () => {
    const version = ++dailyLoadVersion.current;
    setDailyLoading(true);
    setDailyError(null);
    setDailyDetails([]);
    let q = supabase
      .from(MKT_DAILY_DETAILS_TABLE)
      .select('id, report_date, ma_nv, ten_chien_dich, ad_cost_vnd, message_conversations, source_file')
      .gte('report_date', applied.from)
      .lte('report_date', applied.to)
      .order('report_date', { ascending: false })
      .order('ma_nv', { ascending: true })
      .order('ten_chien_dich', { ascending: true });
    if (applied.maNv) q = q.eq('ma_nv', applied.maNv);
    const { data, error: qErr } = await fetchAllRows<typeof dailyDetails[number]>(q);
    if (version !== dailyLoadVersion.current) return;
    if (qErr) {
      setDailyError(qErr.message);
      setDailyDetails([]);
    } else {
      setDailyDetails((data || []) as typeof dailyDetails);
    }
    setDailyLoading(false);
  }, [applied]);

  useEffect(() => { void loadDailyDetails(); }, [loadDailyDetails]);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setError(null);
    setRows([]);
    let q = supabase
      .from(QC_EXCEL_TABLE)
      .select(
        `id, ma_nv, ngay, ten_chien_dich, so_tien_da_chi_tieu_vnd,
         so_tro_chuyen_tin_nhan, source_file, created_at`
      )
      .gte('ngay', applied.from)
      .lte('ngay', applied.to)
      .not('ten_chien_dich', 'ilike', 'all')
      .order('ngay', { ascending: false, nullsFirst: true })
      .order('created_at', { ascending: false });

    if (applied.maNv) q = q.eq('ma_nv', applied.maNv);

    const { data, error: qErr } = await fetchAllRows<RowWithCode>(q);
    if (version !== loadVersion.current) return;
    if (qErr) {
      console.error('project-qc-excel:', qErr);
      setError(
        qErr.message?.includes('does not exist') || qErr.message?.includes('schema cache')
          ? `${qErr.message} — Chạy supabase/create_du_an_qc_excel.sql trong Supabase.`
          : qErr.message || 'Không tải được dữ liệu.'
      );
      setRows([]);
    } else {
      const filtered = (data || []).filter((row) => {
        const day = String(row.ngay || '').slice(0, 10);
        if (!day || day < applied.from || day > applied.to) return false;
        return !applied.maNv || normalizeEmployeeCode(row.ma_nv) === normalizeEmployeeCode(applied.maNv);
      });
      setRows(filtered as RowWithCode[]);
    }
    setLoading(false);
  }, [applied]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyFilters = () => {
    setRows([]);
    setDailyDetails([]);
    setApplied({
      maNv: draftMaNv.trim(),
      from: draftFrom,
      to: draftTo,
    });
  };

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
      if (!window.confirm(`Nh\u1eadp ${parsed.length} d\u00f2ng v\u00e0o b\u1ea3ng QC Excel?`)) return;

      const payloads = parsed.map((r) => ({
        ...r,
        ma_nv: r.ma_nv || extractMaNvFromBracketPage(r.ten_chien_dich) || null,
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

  const handleSyncToDailyDetails = useCallback(async () => {
    const prepared = rows
      .map((row) => {
        const report_date = String(row.ngay || '').slice(0, 10);
        const ma_nv = normalizeEmployeeCode(row.ma_nv || extractMaNvFromBracketPage(row.ten_chien_dich));
        const ten_chien_dich = row.ten_chien_dich?.trim() || '';
        if (!report_date || !ma_nv || !ten_chien_dich) return null;
        return {
          report_date,
          ma_nv,
          ten_chien_dich,
          ad_cost_vnd: Number(row.so_tien_da_chi_tieu_vnd) || 0,
          message_conversations: Number(row.so_tro_chuyen_tin_nhan) || 0,
          source_file: row.source_file,
        };
      })
      .filter(Boolean) as Array<{
        report_date: string;
        ma_nv: string;
        ten_chien_dich: string;
        ad_cost_vnd: number;
        message_conversations: number;
        source_file: string | null;
      }>;

    if (!prepared.length) {
      window.alert('Kh\u00f4ng c\u00f3 d\u00f2ng n\u00e0o c\u00f3 Ng\u00e0y, M\u00e3 NV v\u00e0 t\u00ean chi\u1ebfn d\u1ecbch h\u1ee3p l\u1ec7 \u0111\u1ec3 \u0111\u1ed3ng b\u1ed9.');
      return;
    }

    // One daily record per employee and campaign; repeated rows are summed.
    const byKey = new Map<string, (typeof prepared)[number]>();
    for (const row of prepared) {
      const key = `${row.report_date}\0${row.ma_nv}\0${row.ten_chien_dich}`;
      const current = byKey.get(key);
      if (!current) byKey.set(key, { ...row });
      else {
        current.ad_cost_vnd += row.ad_cost_vnd;
        current.message_conversations += row.message_conversations;
      }
    }
    const payload = Array.from(byKey.values());
    if (!window.confirm(`\u0110\u1ed3ng b\u1ed9 ${payload.length} d\u00f2ng QC v\u00e0 c\u1eadp nh\u1eadt/t\u1ea1o b\u00e1o c\u00e1o MKT theo Ng\u00e0y + M\u00e3 NV?`)) return;

    setPushing(true);
    try {
      const { error: syncError } = await supabase
        .from(MKT_DAILY_DETAILS_TABLE)
        .upsert(payload, { onConflict: 'report_date,ma_nv,ten_chien_dich' });
      if (syncError) throw syncError;

      // Marketing Report reads detail_reports, so also sync one employee/day summary there.
      const byEmployeeDay = new Map<string, { report_date: string; code: string; ad_cost: number; mess_comment_count: number }>();
      for (const row of payload) {
        const code = String(row.ma_nv).trim();
        const key = `${row.report_date}\0${normalizeEmployeeCode(code)}`;
        const current = byEmployeeDay.get(key);
        if (!current) {
          byEmployeeDay.set(key, {
            report_date: row.report_date,
            code,
            ad_cost: row.ad_cost_vnd,
            mess_comment_count: row.message_conversations,
          });
        } else {
          current.ad_cost += row.ad_cost_vnd;
          current.mess_comment_count += row.message_conversations;
        }
      }
      const summaries = Array.from(byEmployeeDay.values());
      const reportDates = Array.from(new Set(summaries.map((row) => row.report_date)));
      const [staffRes, reportRes] = await Promise.all([
        fetchAllRows<{ ma_ns: string | null; name: string | null; email: string | null; team: string | null }>(
          supabase.from(EMPLOYEES_TABLE).select('ma_ns, name, email, team')
        ),
        fetchAllRows<{ id: string; report_date: string; code: string | null; email: string | null }>(
          supabase.from(REPORTS_TABLE).select('id, report_date, code, email').in('report_date', reportDates)
        ),
      ]);
      if (staffRes.error) throw staffRes.error;
      if (reportRes.error) throw reportRes.error;

      const staffByCode = new Map<string, { name: string; email: string | null; team: string | null }>();
      for (const staff of staffRes.data || []) {
        const key = normalizeEmployeeCode(staff.ma_ns);
        if (!key || staffByCode.has(key)) continue;
        const email = String(staff.email || '').trim().toLowerCase();
        staffByCode.set(key, {
          name: String(staff.name || email || staff.ma_ns).trim() || String(staff.ma_ns),
          email: email || null,
          team: staff.team?.trim() || null,
        });
      }

      const reportIdByCodeKey = new Map<string, string>();
      const reportIdByEmailKey = new Map<string, string>();
      for (const report of reportRes.data || []) {
        const day = String(report.report_date).slice(0, 10);
        const codeKey = `${day}\0${normalizeEmployeeCode(report.code)}`;
        const emailKey = `${day}\0${String(report.email || '').trim().toLowerCase()}`;
        if (report.id && normalizeEmployeeCode(report.code) && !reportIdByCodeKey.has(codeKey)) {
          reportIdByCodeKey.set(codeKey, report.id);
        }
        if (report.id && String(report.email || '').trim() && !reportIdByEmailKey.has(emailKey)) {
          reportIdByEmailKey.set(emailKey, report.id);
        }
      }

      let updatedReports = 0;
      let createdReports = 0;
      let skippedNoEmployee = 0;
      let skippedNoEmail = 0;
      const reportChunk = 60;
      const reportUpdates: { id: string; patch: { ad_cost: number; mess_comment_count: number; code: string } }[] = [];
      const reportInserts: Record<string, unknown>[] = [];
      for (const row of summaries) {
        const key = `${row.report_date}\0${normalizeEmployeeCode(row.code)}`;
        const staff = staffByCode.get(normalizeEmployeeCode(row.code));
        const id = reportIdByCodeKey.get(key) || (staff ? reportIdByEmailKey.get(`${row.report_date}\0${staff.email}`) : undefined);
        if (id) {
          reportUpdates.push({
            id,
            patch: { ad_cost: row.ad_cost, mess_comment_count: row.mess_comment_count, code: row.code },
          });
          continue;
        }
        if (!staff) {
          skippedNoEmployee++;
          continue;
        }
        if (!staff.email) {
          skippedNoEmail++;
          continue;
        }
        reportInserts.push({
          report_date: row.report_date,
          code: row.code,
          name: staff.name,
          email: staff.email,
          team: staff.team,
          ad_cost: row.ad_cost,
          mess_comment_count: row.mess_comment_count,
        });
      }

      for (let i = 0; i < reportUpdates.length; i += reportChunk) {
        const part = reportUpdates.slice(i, i + reportChunk);
        const results = await Promise.all(
          part.map(({ id, patch }) => supabase.from(REPORTS_TABLE).update(patch).eq('id', id))
        );
        const updateError = results.find((result) => result.error)?.error;
        if (updateError) throw updateError;
        updatedReports += part.length;
      }
      for (let i = 0; i < reportInserts.length; i += reportChunk) {
        const part = reportInserts.slice(i, i + reportChunk);
        const { error: insertError } = await supabase.from(REPORTS_TABLE).insert(part);
        if (insertError) throw insertError;
        createdReports += part.length;
      }

      const skippedTail = skippedNoEmployee
        ? ` ${skippedNoEmployee} d\u00f2ng kh\u00f4ng c\u00f3 nh\u00e2n vi\u00ean kh\u1edbp M\u00e3 NV trong employees n\u00ean b\u1ecb b\u1ecf qua.`
        : '';
      const missingEmailTail = skippedNoEmail
        ? ` ${skippedNoEmail} d\u00f2ng kh\u1edbp M\u00e3 NV nh\u01b0ng nh\u00e2n s\u1ef1 ch\u01b0a c\u00f3 email; th\u00eam email trong Qu\u1ea3n l\u00fd nh\u00e2n s\u1ef1 r\u1ed3i b\u1ea5m \u0110\u1ed3ng b\u1ed9 l\u1ea1i.`
        : '';
      setExcelMsg(
        `\u0110\u00e3 \u0111\u1ed3ng b\u1ed9 ${payload.length} chi ti\u1ebft QC; Marketing Report: c\u1eadp nh\u1eadt ${updatedReports}, t\u1ea1o m\u1edbi ${createdReports} d\u00f2ng.${skippedTail}${missingEmailTail}`
      );
      await loadDailyDetails();
    } catch (e) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as any).message) : '\u0110\u1ed3ng b\u1ed9 th\u1ea5t b\u1ea1i.';
      setExcelMsg(`L\u1ed7i: ${msg}`);
      window.alert(`\u0110\u1ed3ng b\u1ed9 th\u1ea5t b\u1ea1i: ${msg}`);
    } finally {
      setPushing(false);
    }
  }, [rows, loadDailyDetails]);

  const summary = useMemo(() => {
    if (!rows.length) return 'Chưa có dòng trong bộ lọc';
    return `${rows.length} dòng · ${applied.from} → ${applied.to}`;
  }, [rows.length, applied]);

  return (
    <div className="dash-fade-up">
      <div className="mb-3 flex items-center gap-3 rounded-[10px] border border-[var(--border)] bg-[var(--bg2)] px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[9px] bg-gradient-to-br from-[#6d9fe5] to-[#3e659a] text-[11px] font-extrabold tracking-[-0.5px] text-white shadow-sm">MAP</div>
        <div className="min-w-0">
          <div className="text-[12px] font-extrabold text-[var(--text)]">MAP - Marketing Analytic Platform</div>
          <div className="text-[10px] text-[var(--text3)]">{'Chi ti\u1ebft MKT theo ng\u00e0y'}</div>
        </div>
      </div>
      <SectionCard
        title="📊 Dữ liệu QC Excel theo Mã NV"
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
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => void handleUpload(e.target.files?.[0] ?? null)}
            />
            <details className="relative">
              <summary
                className="flex cursor-pointer list-none items-center gap-1.5 rounded-[6px] border border-[#10b981] px-3 py-1.5 text-[11px] font-bold text-[#34d399] [&::-webkit-details-marker]:hidden"
                aria-label="Các thao tác Excel"
              >
                <FileSpreadsheet size={13} />
                Excel
                <ChevronDown size={13} />
              </summary>
              <div className="absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg2)] p-1 shadow-xl">
                <div className="px-2 py-1.5 text-[9px] font-extrabold uppercase tracking-wide text-[var(--text3)]">Mẫu Excel</div>
                <button type="button" onClick={(e) => { e.currentTarget.closest('details')?.removeAttribute('open'); downloadQcExcelTemplate(); }} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[11px] text-[var(--text2)] hover:bg-white/5">
                  <Download size={13} /> Tải mẫu Excel QC
                </button>
                <div className="my-1 border-t border-[var(--border)]" />
                <div className="px-2 py-1.5 text-[9px] font-extrabold uppercase tracking-wide text-[var(--text3)]">Nhập dữ liệu</div>
                <button type="button" disabled={excelBusy} onClick={(e) => { e.currentTarget.closest('details')?.removeAttribute('open'); fileRef.current?.click(); }} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[11px] text-[var(--text2)] hover:bg-white/5 disabled:opacity-50">
                  <Upload size={13} /> Tải lên dữ liệu QC
                </button>
                <div className="my-1 border-t border-[var(--border)]" />
                <div className="px-2 py-1.5 text-[9px] font-extrabold uppercase tracking-wide text-[var(--text3)]">Đồng bộ</div>
                <button type="button" disabled={pushing || loading || rows.length === 0} onClick={(e) => { e.currentTarget.closest('details')?.removeAttribute('open'); void handleSyncToDailyDetails(); }} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[11px] text-[var(--text2)] hover:bg-white/5 disabled:opacity-50">
                  <RefreshCw size={13} /> {'\u0110\u1ed3ng b\u1ed9 QC v\u00e0o chi ti\u1ebft MKT'}
                </button>
              </div>
            </details>
          </div>
        }
      >
        <div className="p-[14px_16px] border-b border-[var(--border)] bg-[var(--bg3)] space-y-3">
          <div className="flex flex-wrap gap-3 items-end">
            <label className="flex flex-col gap-1 min-w-[160px]">
              <span className="text-[9px] font-extrabold uppercase text-[var(--text3)]">Mã NV</span>
              <input type="text" value={draftMaNv} onChange={(e) => setDraftMaNv(e.target.value)} placeholder="Tất cả"
                className="bg-[var(--bg2)] border border-[var(--border)] rounded-[8px] text-[12px] p-2 text-[var(--text)]" />
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
            Cột Excel: Ngày, Mã NV, Tên chiến dịch, Số tiền đã chi tiêu (VND), Số trò chuyện qua tin nhắn.
            Mã NV có thể điền riêng hoặc tự lấy từ ngoặc vuông trong tên chiến dịch.
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
            <table className="w-full border-collapse min-w-[900px] text-left">
              <thead>
                <tr className="border-b border-[var(--border)] text-[9px] font-extrabold uppercase tracking-wide text-[var(--text3)]">
                  <th className="p-2 whitespace-nowrap">Mã NV</th>
                  <th className="p-2 whitespace-nowrap">Ngày</th>
                  <th className="p-2 min-w-[220px]">Tên chiến dịch</th>
                  <th className="p-2 text-right">Chi tiêu (VND)</th>
                  <th className="p-2 text-right">Trò chuyện</th>
                  <th className="p-2">File</th>
                </tr>
              </thead>
              <tbody className="text-[11px] text-[var(--text2)] font-[var(--mono)]">
                {rows.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-[var(--text3)] font-bold">
                      Không có dữ liệu — nhập Excel hoặc nới bộ lọc ngày.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const ngay = r.ngay?.slice(0, 10) || '';
                    return (
                      <tr key={r.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)]">
                        <td className="p-2 whitespace-nowrap font-bold text-[var(--text)]">{r.ma_nv || '—'}</td>
                        <td className="p-2 whitespace-nowrap">{ngay ? formatReportDateVi(ngay) : '\u2014'}</td>
                        <td className="p-2 max-w-[300px] truncate" title={r.ten_chien_dich || ''}>{r.ten_chien_dich || '—'}</td>
                        <td className="p-2 text-right">{formatFullVnd(r.so_tien_da_chi_tieu_vnd)}</td>
                        <td className="p-2 text-right">{r.so_tro_chuyen_tin_nhan ?? '—'}</td>
                        <td className="p-2 max-w-[160px] truncate text-[10px]" title={r.source_file || ''}>{r.source_file || '—'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title={'Chi ti\u1ebft MKT theo ng\u00e0y'}
        subtitle={`${dailyDetails.length} d\u00f2ng trong ${MKT_DAILY_DETAILS_TABLE}`}
        bodyPadding={false}
        actions={
          <button type="button" onClick={() => void loadDailyDetails()} disabled={dailyLoading}
            className="rounded-[6px] border border-[var(--border)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--text2)] disabled:opacity-50">
            {dailyLoading ? '\u0110ang t\u1ea3i...' : 'L\u00e0m m\u1edbi'}
          </button>
        }
      >
        {dailyError && <div className="p-3 text-[11px] font-bold text-[var(--R)]">{dailyError}. Ch\u1ea1y supabase/create_mkt_daily_details.sql.</div>}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[900px] text-left">
            <thead><tr className="border-b border-[var(--border)] text-[9px] font-extrabold uppercase tracking-wide text-[var(--text3)]">
              <th className="p-2">{'Ng\u00e0y'}</th><th className="p-2">{'M\u00e3 NV'}</th><th className="p-2 min-w-[220px]">{'T\u00ean chi\u1ebfn d\u1ecbch'}</th>
              <th className="p-2 text-right">{'Chi ti\u00eau (VND)'}</th><th className="p-2 text-right">{'Tr\u00f2 chuy\u1ec7n'}</th><th className="p-2">File</th>
            </tr></thead>
            <tbody className="text-[11px] text-[var(--text2)] font-[var(--mono)]">
              {dailyDetails.length === 0 && !dailyLoading ? (
                <tr><td colSpan={6} className="p-8 text-center text-[var(--text3)] font-bold">Ch\u01b0a c\u00f3 chi ti\u1ebft MKT trong kho\u1ea3ng ng\u00e0y n\u00e0y.</td></tr>
              ) : dailyDetails.map((row) => (
                <tr key={row.id} className="border-b border-[rgba(255,255,255,0.04)]">
                  <td className="p-2 whitespace-nowrap">{formatReportDateVi(row.report_date)}</td>
                  <td className="p-2 font-bold">{row.ma_nv}</td>
                  <td className="p-2 max-w-[320px] truncate" title={row.ten_chien_dich}>{row.ten_chien_dich}</td>
                  <td className="p-2 text-right">{formatFullVnd(row.ad_cost_vnd)}</td>
                  <td className="p-2 text-right">{row.message_conversations}</td>
                  <td className="p-2 max-w-[160px] truncate text-[10px]" title={row.source_file || ''}>{row.source_file || '\u2014'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>


    </div>
  );
};
