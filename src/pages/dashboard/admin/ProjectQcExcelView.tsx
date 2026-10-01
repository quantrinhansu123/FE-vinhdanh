import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, Loader2, RefreshCw, Trash2, Upload } from 'lucide-react';
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
const PAGE_SIZE = 50;

function normalizeEmployeeCode(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\u00a0/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleUpperCase();
}

function qcDuplicateKey(
  date: string,
  employeeCode: string | null | undefined,
  campaign: string | null | undefined,
  spend: unknown,
  conversations: unknown
): string {
  const campaignKey = String(campaign ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  const numericKey = (value: unknown, digits: number) => {
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(digits) : '0';
  };
  return JSON.stringify([
    String(date ?? '').slice(0, 10),
    normalizeEmployeeCode(employeeCode),
    campaignKey,
    numericKey(spend, 2),
    numericKey(conversations, 4),
  ]);
}

async function deleteQcRows(ids: string[]): Promise<number> {
  const batchSize = 200;
  let deletedCount = 0;
  for (let start = 0; start < ids.length; start += batchSize) {
    const { data, error } = await supabase
      .from(QC_EXCEL_TABLE)
      .delete()
      .in('id', ids.slice(start, start + batchSize))
      .select('id');
    if (error) throw error;
    deletedCount += data?.length ?? 0;
  }
  return deletedCount;
}

async function deleteMktDailyRows(ids: string[]): Promise<number> {
  const batchSize = 200;
  let deletedCount = 0;
  for (let start = 0; start < ids.length; start += batchSize) {
    const { data, error } = await supabase
      .from(MKT_DAILY_DETAILS_TABLE)
      .delete()
      .in('id', ids.slice(start, start + batchSize))
      .select('id');
    if (error) throw error;
    deletedCount += data?.length ?? 0;
  }
  return deletedCount;
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}


export const ProjectQcExcelView: React.FC = () => {
  const defaultTo = toYmd(new Date());
  const defaultFrom = defaultTo;

  const [draftMaNv, setDraftMaNv] = useState('');
  const [draftFrom, setDraftFrom] = useState(defaultFrom);
  const [draftTo, setDraftTo] = useState(defaultTo);
  const [applied, setApplied] = useState({ maNv: '', from: defaultFrom, to: defaultTo });
  const loadVersion = useRef(0);
  const dailyLoadVersion = useRef(0);

  const [rows, setRows] = useState<RowWithCode[]>([]);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deleting, setDeleting] = useState(false);
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
  const [dailyDeleting, setDailyDeleting] = useState(false);
  const [dailyMsg, setDailyMsg] = useState<string | null>(null);
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

  const handleDeleteAllDailyDetails = async () => {
    const ids = dailyDetails.map((row) => row.id);
    if (!ids.length || dailyDeleting || dailyLoading) return;
    const employeeFilter = applied.maNv ? `, mã NV ${applied.maNv}` : '';
    const prompt = `Xóa toàn bộ ${ids.length} dòng Chi tiết MKT theo bộ lọc ngày ${applied.from} đến ${applied.to}${employeeFilter}? Dữ liệu báo cáo MKT này sẽ bị xóa.`;
    if (!window.confirm(prompt)) return;

    setDailyDeleting(true);
    setDailyError(null);
    setDailyMsg(null);
    try {
      const deletedCount = await deleteMktDailyRows(ids);
      setDailyMsg(`Đã xóa ${deletedCount}/${ids.length} dòng Chi tiết MKT.`);
      await loadDailyDetails();
    } catch (e) {
      const message = e && typeof e === 'object' && 'message' in e ? String(e.message) : 'Không xóa được Chi tiết MKT.';
      setDailyError(message);
    } finally {
      setDailyDeleting(false);
    }
  };

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setError(null);
    setRows([]);
    setSelectedIds(new Set());
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
      setPage(1);
    }
    setLoading(false);
  }, [applied]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyFilters = () => {
    setRows([]);
    setDailyDetails([]);
    setSelectedIds(new Set());
    setPage(1);
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

      const dateFrom = parsed.reduce((min, row) => (row.ngay < min ? row.ngay : min), parsed[0].ngay);
      const dateTo = parsed.reduce((max, row) => (row.ngay > max ? row.ngay : max), parsed[0].ngay);
      const { data: existingRows, error: existingError } = await fetchAllRows<{
        id: string;
        ma_nv: string | null;
        ngay: string;
        ten_chien_dich: string | null;
        so_tien_da_chi_tieu_vnd: number | null;
        so_tro_chuyen_tin_nhan: number | null;
      }>(supabase
        .from(QC_EXCEL_TABLE)
        .select('id, ma_nv, ngay, ten_chien_dich, so_tien_da_chi_tieu_vnd, so_tro_chuyen_tin_nhan')
        .gte('ngay', dateFrom)
        .lte('ngay', dateTo));
      if (existingError) {
        console.error('project-qc-excel duplicate check:', existingError);
        window.alert(`Không kiểm tra được dữ liệu trùng: ${existingError.message || 'Unknown'}. Chưa nhập file.`);
        return;
      }

      const existingByKey = new Map((existingRows || []).map((row) => [qcDuplicateKey(
        row.ngay,
        row.ma_nv || extractMaNvFromBracketPage(row.ten_chien_dich),
        row.ten_chien_dich,
        row.so_tien_da_chi_tieu_vnd,
        row.so_tro_chuyen_tin_nhan
      ), row]));
      const uniquePayloads = payloads.filter((row) => {
        const key = qcDuplicateKey(row.ngay, row.ma_nv, row.ten_chien_dich, row.so_tien_da_chi_tieu_vnd, row.so_tro_chuyen_tin_nhan);
        const existing = existingByKey.get(key);
        if (existing) return false;
        existingByKey.set(key, { ...row, id: '' });
        return true;
      });
      const skippedDuplicates = payloads.length - uniquePayloads.length;
      if (uniquePayloads.length === 0) {
        setExcelMsg(`Không có dòng mới; đã bỏ qua ${skippedDuplicates} dòng trùng.`);
        await load();
        return;
      }

      const chunk = 60;
      let done = 0;
      for (let i = 0; i < uniquePayloads.length; i += chunk) {
        const part = uniquePayloads.slice(i, i + chunk);
        const { error: insErr } = await supabase.from(QC_EXCEL_TABLE).insert(part);
        if (insErr) {
          console.error(insErr);
          window.alert(`Lỗi ghi DB (${done}/${uniquePayloads.length}): ${insErr.message}`);
          await load();
          return;
        }
        done += part.length;
      }
      setExcelMsg(`Đã nhập ${done} dòng từ «${file.name}»; bỏ qua ${skippedDuplicates} dòng trùng.`);
      await load();
    } finally {
      setExcelBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSyncToDailyDetails = useCallback(async () => {
    const grouped = new Map<string, {
      report_date: string;
      ma_nv: string;
      ten_chien_dich: string;
      ad_cost_vnd: number;
      message_conversations: number;
      source_file: string | null;
    }>();
    let skippedInvalidRows = 0;

    for (const row of rows) {
      const report_date = String(row.ngay || '').slice(0, 10);
      const ma_nv = String(row.ma_nv || extractMaNvFromBracketPage(row.ten_chien_dich) || '').trim();
      const ten_chien_dich = row.ten_chien_dich?.trim() || '';
      if (!report_date || !ma_nv || !ten_chien_dich) {
        skippedInvalidRows++;
        continue;
      }

      const key = `${report_date}\u0000${ma_nv}\u0000${ten_chien_dich}`;
      const current = grouped.get(key);
      if (current) {
        current.ad_cost_vnd += Number(row.so_tien_da_chi_tieu_vnd) || 0;
        current.message_conversations += Number(row.so_tro_chuyen_tin_nhan) || 0;
      } else {
        grouped.set(key, {
          report_date,
          ma_nv,
          ten_chien_dich,
          ad_cost_vnd: Number(row.so_tien_da_chi_tieu_vnd) || 0,
          message_conversations: Number(row.so_tro_chuyen_tin_nhan) || 0,
          source_file: row.source_file,
        });
      }
    }

    const payload = Array.from(grouped.values());
    if (!payload.length) {
      window.alert('Kh\u00f4ng c\u00f3 d\u00f2ng QC h\u1ee3p l\u1ec7 \u0111\u1ec3 \u0111\u1ed3ng b\u1ed9.');
      return;
    }

    setPushing(true);
    try {
      const { error: syncError } = await supabase
        .from(MKT_DAILY_DETAILS_TABLE)
        .upsert(payload, { onConflict: 'report_date,ma_nv,ten_chien_dich' });
      if (syncError) throw syncError;

      let reportStatus = '';
      try {
        const byEmployeeDay = new Map<string, { report_date: string; code: string; ad_cost: number; mess_comment_count: number }>();
        for (const row of payload) {
          const code = String(row.ma_nv).trim();
          const key = `${row.report_date}\u0000${normalizeEmployeeCode(code)}`;
          const current = byEmployeeDay.get(key);
          if (current) {
            current.ad_cost += row.ad_cost_vnd;
            current.mess_comment_count += row.message_conversations;
          } else {
            byEmployeeDay.set(key, {
              report_date: row.report_date,
              code,
              ad_cost: row.ad_cost_vnd,
              mess_comment_count: row.message_conversations,
            });
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

        const reportIdByCode = new Map<string, string>();
        const reportIdByEmail = new Map<string, string>();
        for (const report of reportRes.data || []) {
          const day = String(report.report_date).slice(0, 10);
          const codeKey = `${day}\u0000${normalizeEmployeeCode(report.code)}`;
          const emailKey = `${day}\u0000${String(report.email || '').trim().toLowerCase()}`;
          if (report.id && normalizeEmployeeCode(report.code) && !reportIdByCode.has(codeKey)) {
            reportIdByCode.set(codeKey, report.id);
          }
          if (report.id && String(report.email || '').trim() && !reportIdByEmail.has(emailKey)) {
            reportIdByEmail.set(emailKey, report.id);
          }
        }

        let updatedReports = 0;
        let createdReports = 0;
        let skippedReports = 0;
        const updates: { id: string; patch: Record<string, unknown> }[] = [];
        const inserts: Record<string, unknown>[] = [];
        for (const row of summaries) {
          const dayCodeKey = `${row.report_date}\u0000${normalizeEmployeeCode(row.code)}`;
          const staff = staffByCode.get(normalizeEmployeeCode(row.code));
          const existingId = reportIdByCode.get(dayCodeKey) ||
            (staff?.email ? reportIdByEmail.get(`${row.report_date}\u0000${staff.email}`) : undefined);
          if (existingId) {
            updates.push({
              id: existingId,
              patch: {
                ad_cost: row.ad_cost,
                mess_comment_count: row.mess_comment_count,
                code: row.code,
                ...(staff ? { name: staff.name } : {}),
              },
            });
          } else if (staff?.email) {
            inserts.push({
              report_date: row.report_date,
              code: row.code,
              name: staff.name,
              email: staff.email,
              team: staff.team,
              ad_cost: row.ad_cost,
              mess_comment_count: row.mess_comment_count,
            });
          } else {
            skippedReports++;
          }
        }

        for (let i = 0; i < updates.length; i += 60) {
          const batch = updates.slice(i, i + 60);
          const results = await Promise.all(
            batch.map(({ id, patch }) => supabase.from(REPORTS_TABLE).update(patch).eq('id', id))
          );
          const updateError = results.find((result) => result.error)?.error;
          if (updateError) throw updateError;
          updatedReports += batch.length;
        }
        for (let i = 0; i < inserts.length; i += 60) {
          const batch = inserts.slice(i, i + 60);
          const { error: insertError } = await supabase.from(REPORTS_TABLE).insert(batch);
          if (insertError) throw insertError;
          createdReports += batch.length;
        }

        reportStatus = ` Report: cập nhật ${updatedReports}, tạo mới ${createdReports}` +
          (skippedReports ? `, bỏ qua ${skippedReports} dòng do không khớp nhân viên hoặc thiếu email.` : '.') ;
      } catch (reportError) {
        const detail = reportError && typeof reportError === 'object' && 'message' in reportError
          ? String(reportError.message)
          : 'Không rõ nguyên nhân';
        reportStatus = ` Chưa đồng bộ được bảng report: ${detail}`;
      }

      const skippedTail = skippedInvalidRows
        ? ` \u0110\u00e3 b\u1ecf qua ${skippedInvalidRows.toLocaleString('vi-VN')} d\u00f2ng thi\u1ebfu Ng\u00e0y, M\u00e3 NV ho\u1eb7c T\u00ean chi\u1ebfn d\u1ecbch.`
        : '';
      const includedRows = rows.length - skippedInvalidRows;
      setExcelMsg(
        `\u0110\u00e3 c\u1ed9ng ${includedRows.toLocaleString('vi-VN')}/${rows.length.toLocaleString('vi-VN')} d\u00f2ng QC th\u00e0nh ${payload.length.toLocaleString('vi-VN')} d\u00f2ng chi ti\u1ebft MKT.${skippedTail}${reportStatus}`
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

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const totalSpend = useMemo(
    () => rows.reduce((sum, row) => sum + (Number(row.so_tien_da_chi_tieu_vnd) || 0), 0),
    [rows],
  );
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, safePage]);
  const pageIds = pageRows.map((row) => row.id);
  const selectedOnPage = pageIds.filter((id) => selectedIds.has(id)).length;
  const allPageSelected = pageIds.length > 0 && selectedOnPage === pageIds.length;

  const togglePageSelection = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    const ids = [...selectedIds];
    if (!ids.length || deleting) return;
    if (!window.confirm(`Xóa ${ids.length} dòng QC đã chọn? Thao tác này không thể hoàn tác.`)) return;

    setDeleting(true);
    setError(null);
    try {
      const deletedCount = await deleteQcRows(ids);
      setSelectedIds(new Set());
      setExcelMsg(`Đã xóa ${deletedCount} dòng QC.`);
      await load();
    } catch (e) {
      const message = e && typeof e === 'object' && 'message' in e ? String(e.message) : 'Không xóa được các dòng đã chọn.';
      setError(message);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAllFiltered = async () => {
    const ids = rows.map((row) => row.id);
    if (!ids.length || deleting || loading) return;
    const employeeFilter = applied.maNv ? `, mã NV ${applied.maNv}` : '';
    const prompt = `Xóa toàn bộ ${ids.length} dòng QC theo bộ lọc ngày ${applied.from} đến ${applied.to}${employeeFilter}? Thao tác này không thể hoàn tác.`;
    if (!window.confirm(prompt)) return;

    setDeleting(true);
    setError(null);
    try {
      const deletedCount = await deleteQcRows(ids);
      setSelectedIds(new Set());
      setExcelMsg(`Đã xóa ${deletedCount}/${ids.length} dòng QC theo bộ lọc.`);
      await load();
    } catch (e) {
      const message = e && typeof e === 'object' && 'message' in e ? String(e.message) : 'Không xóa được dữ liệu QC.';
      setError(message);
    } finally {
      setDeleting(false);
    }
  };

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
              onClick={() => void handleDeleteAllFiltered()}
              disabled={rows.length === 0 || deleting || loading}
              title="Xóa tất cả dòng khớp bộ lọc hiện tại"
              className="flex items-center gap-1.5 rounded-[6px] border border-[rgba(239,68,68,0.5)] bg-[rgba(239,68,68,0.16)] px-2.5 py-1.5 text-[11px] font-extrabold text-[var(--R)] hover:bg-[rgba(239,68,68,0.24)] disabled:opacity-40"
            >
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Xóa tất cả ({rows.length})
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteSelected()}
              disabled={selectedIds.size === 0 || deleting || loading}
              className="flex items-center gap-1.5 rounded-[6px] border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--R)] hover:bg-[rgba(239,68,68,0.14)] disabled:opacity-40"
            >
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              {deleting ? 'Đang xóa...' : `Xóa đã chọn${selectedIds.size ? ` (${selectedIds.size})` : ''}`}
            </button>
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

        <div className="grid grid-cols-1 gap-3 border-b border-[var(--border)] bg-[var(--bg2)] p-3 sm:grid-cols-2">
          <div className="rounded-[8px] border border-[var(--border)] bg-[var(--bg3)] px-4 py-3">
            <div className="text-[9px] font-extrabold uppercase tracking-wide text-[var(--text3)]">Tổng chi tiêu theo bộ lọc</div>
            <div className="mt-1 text-[20px] font-black text-[var(--text)]">{formatFullVnd(totalSpend)} <span className="text-[11px] font-bold">VND</span></div>
          </div>
          <div className="rounded-[8px] border border-[var(--border)] bg-[var(--bg3)] px-4 py-3">
            <div className="text-[9px] font-extrabold uppercase tracking-wide text-[var(--text3)]">Số dòng trong bộ lọc</div>
            <div className="mt-1 text-[20px] font-black text-[var(--text)]">{rows.length.toLocaleString('vi-VN')} <span className="text-[11px] font-bold">dòng</span></div>
          </div>
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
                  <th className="w-9 p-2 text-center">
                    <input
                      type="checkbox"
                      aria-label="Chọn tất cả dòng trên trang này"
                      checked={allPageSelected}
                      ref={(input) => { if (input) input.indeterminate = selectedOnPage > 0 && !allPageSelected; }}
                      onChange={togglePageSelection}
                      disabled={loading || pageIds.length === 0}
                    />
                  </th>
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
                    <td colSpan={7} className="p-10 text-center text-[var(--text3)] font-bold">
                      Không có dữ liệu — nhập Excel hoặc nới bộ lọc ngày.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r) => {
                    const ngay = r.ngay?.slice(0, 10) || '';
                    return (
                      <tr key={r.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)]">
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            aria-label={`Chọn dòng ${r.ma_nv || r.id} ngày ${ngay}`}
                            checked={selectedIds.has(r.id)}
                            onChange={() => setSelectedIds((current) => {
                              const next = new Set(current);
                              if (next.has(r.id)) next.delete(r.id);
                              else next.add(r.id);
                              return next;
                            })}
                          />
                        </td>
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
        {!loading && rows.length > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-3 py-2 text-[10px] text-[var(--text3)]">
            <span>Hiển thị {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, rows.length)} / {rows.length} dòng</span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded border border-[var(--border)] px-2 py-1 disabled:opacity-40">Trước</button>
              <span>{safePage}/{totalPages}</span>
              <button type="button" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded border border-[var(--border)] px-2 py-1 disabled:opacity-40">Sau</button>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={'Chi ti\u1ebft MKT theo ng\u00e0y'}
        subtitle={`${dailyDetails.length} d\u00f2ng trong ${MKT_DAILY_DETAILS_TABLE}`}
        bodyPadding={false}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void handleDeleteAllDailyDetails()} disabled={dailyDetails.length === 0 || dailyDeleting || dailyLoading}
              className="flex items-center gap-1.5 rounded-[6px] border border-[rgba(239,68,68,0.5)] bg-[rgba(239,68,68,0.16)] px-2.5 py-1.5 text-[11px] font-extrabold text-[var(--R)] hover:bg-[rgba(239,68,68,0.24)] disabled:opacity-40">
              {dailyDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              {dailyDeleting ? 'Đang xóa...' : `Xóa tất cả (${dailyDetails.length})`}
            </button>
            <button type="button" onClick={() => void loadDailyDetails()} disabled={dailyLoading || dailyDeleting}
              className="rounded-[6px] border border-[var(--border)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--text2)] disabled:opacity-50">
              {dailyLoading ? '\u0110ang t\u1ea3i...' : 'L\u00e0m m\u1edbi'}
            </button>
          </div>
        }
      >
        {dailyError && <div className="p-3 text-[11px] font-bold text-[var(--R)]">{dailyError}. Ch\u1ea1y supabase/create_mkt_daily_details.sql.</div>}
        {dailyMsg && <div className="p-3 text-[11px] font-bold text-[var(--G)]">{dailyMsg}</div>}
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
