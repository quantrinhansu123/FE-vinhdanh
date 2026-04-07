import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Loader2, RefreshCw, Upload } from 'lucide-react';
import { SectionCard } from '../../../components/crm-dashboard/atoms/SharedAtoms';
import { supabase } from '../../../api/supabase';
import type { DuAnQcExcelRow, DuAnRow } from '../../../types';
import { formatCompactVnd, formatReportDateVi, REPORTS_TABLE, extractMaNvFromBracketPage } from '../mkt/mktDetailReportShared';
import {
  QC_EXCEL_TABLE,
  downloadQcExcelTemplate,
  parseQcExcelFile,
} from './projectQcExcel';
import { parseMktReportExcelFile, downloadMktReportExcelTemplate } from '../mkt/mktHistoryExcel';
import type { MktExcelInsertRow } from '../mkt/mktHistoryExcel';

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
  const reportExcelRef = useRef<HTMLInputElement>(null);
  const [pushing, setPushing] = useState(false);
  const [stagedReportRows, setStagedReportRows] = useState<MktExcelInsertRow[]>([]);
  const [lastPushed, setLastPushed] = useState<
    {
      report_date: string;
      product: string | null;
      market: string | null;
      page: string | null;
      ad_account: string | null;
      ad_cost: number;
      mess_comment_count: number;
      order_count: number | null;
      revenue: number;
      team: string | null;
      name: string | null;
      email: string;
      code: string | null;
    }[]
  >([]);
  const currentUserEmail = useMemo(() => {
    try {
      const raw = localStorage.getItem('fe_vinhdanh_auth_user');
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { email?: string | null };
      const e = parsed?.email?.trim();
      return e && /\S+@\S+\.\S+/.test(e) ? e : null;
    } catch {
      return null;
    }
  }, []);

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
      // Hiển thị ngay các dòng vừa nhập, tránh bị lọc ngoài khoảng ngày
      const { data: justInserted } = await supabase
        .from(QC_EXCEL_TABLE)
        .select(
          `id, du_an_id, ten_tai_khoan, ten_quang_cao, ngay, don_vi_tien_te,
           so_tien_chi_tieu_vnd, chi_phi_mua, cpm, ctr_tat_ca, luot_tro_chuyen_tin_nhan, cpc,
           bao_cao_tu, bao_cao_den, source_file, created_at,
           du_an ( ten_du_an, ma_du_an )`
        )
        .eq('source_file', file.name.slice(0, 240))
        .order('ngay', { ascending: false, nullsFirst: true })
        .order('created_at', { ascending: false });
      if (justInserted) {
        setRows((justInserted || []) as RowWithProject[]);
      } else {
        await load();
      }
    } finally {
      setExcelBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // Chọn file báo cáo MKT → chỉ parse và hiển thị preview; không ghi DB ngay
  const handleUploadReportExcel = useCallback(async (file: File | null) => {
    setExcelMsg(null);
    if (!file?.name) return;
    setExcelBusy(true);
    try {
      const { rows: parsed, errors } = await parseMktReportExcelFile(file);
      if (errors.length) {
        const head = errors
          .slice(0, 12)
          .map((e) => `Dòng ${e.row}: ${e.msg}`)
          .join('\n');
        window.alert(`Lỗi đọc file:\n${head}${errors.length > 12 ? `\n… +${errors.length - 12} lỗi` : ''}`);
        return;
      }
      if (parsed.length === 0) {
        window.alert('Không có dòng dữ liệu để nhập.');
        return;
      }
      setStagedReportRows(parsed);
      setExcelMsg(`Đã đọc ${parsed.length} dòng từ Excel — kiểm tra bảng Preview rồi bấm “Đồng bộ báo cáo”.`);
    } finally {
      setExcelBusy(false);
      if (reportExcelRef.current) reportExcelRef.current.value = '';
    }
  }, [currentUserEmail]);

  // Ghi các dòng đã parse (preview) vào detail_reports — khóa (report_date, code), chỉ cập nhật ad_cost
  const commitStagedReportRows = useCallback(async () => {
    if (!currentUserEmail) {
      window.alert('Cần đăng nhập để đồng bộ.');
      return;
    }
    if (stagedReportRows.length === 0) {
      window.alert('Không có dòng nào để đồng bộ.');
      return;
    }
    const ok = window.confirm(`Đồng bộ ${stagedReportRows.length} dòng vào detail_reports với email ${currentUserEmail}?`);
    if (!ok) return;
    setExcelBusy(true);
    try {
      const email = currentUserEmail;
      const name = currentUserEmail;
      const team = null;

      type Prep = {
        report_date: string;
        code: string;
        product: string | null;
        market: string | null;
        page: string | null;
        ad_account: string | null;
        ad_cost: number;
        mess_comment_count: number;
        order_count: number | null;
        team: string | null;
        name: string | null;
        email: string;
      };

      // Chuẩn hoá: chỉ giữ dòng có ngày + code
      const prepped: Prep[] = [];
      for (const r of stagedReportRows) {
        const report_date = String(r.report_date || '').slice(0, 10);
        const code = extractMaNvFromBracketPage(r.page) || null;
        if (!report_date || !code) continue;
        prepped.push({
          report_date,
          code,
          product: r.product || null,
          market: r.market || null,
          page: r.page || null,
          ad_account: r.ad_account || null,
          ad_cost: Number(r.ad_cost) || 0,
          mess_comment_count: Number(r.mess_comment_count) || 0,
          order_count: Number.isFinite(Number(r.order_count)) ? Number(r.order_count) : null,
          team,
          name,
          email,
        });
      }
      if (prepped.length === 0) {
        window.alert('Không có dòng hợp lệ (thiếu ngày hoặc code).');
        return;
      }

      // Gộp trùng trong batch theo (report_date, code)
      const merged = new Map<string, Prep>();
      for (const p of prepped) {
        const k = `${p.report_date}\0${p.code}`;
        const ex = merged.get(k);
        if (ex) {
          ex.ad_cost += p.ad_cost;
          ex.mess_comment_count += p.mess_comment_count;
          if (ex.order_count == null && p.order_count != null) ex.order_count = p.order_count;
          if (!ex.product && p.product) ex.product = p.product;
          if (!ex.market && p.market) ex.market = p.market;
          if (!ex.page && p.page) ex.page = p.page;
          if (!ex.ad_account && p.ad_account) ex.ad_account = p.ad_account;
        } else {
          merged.set(k, { ...p });
        }
      }
      const prepared = Array.from(merged.values());

      // Tra ID hiện có theo (report_date, code)
      const days = Array.from(new Set(prepared.map((p) => p.report_date)));
      const codes = Array.from(new Set(prepared.map((p) => p.code)));
      const { data: existing, error: selErr } = await supabase
        .from(REPORTS_TABLE)
        .select('id, report_date, code')
        .in('report_date', days)
        .in('code', codes);
      if (selErr) throw selErr;
      const idByKey = new Map<string, string>();
      for (const row of existing || []) {
        const k = `${(row as any).report_date}\0${(row as any).code}`;
        idByKey.set(k, (row as any).id);
      }

      const payload = prepared.map((p) => {
        const k = `${p.report_date}\0${p.code}`;
        const id = idByKey.get(k);
        return {
          ...(id ? { id } : {}),
          ...p,
        };
      });

      // Không dựa vào onConflict (có thể chưa có unique index). Tách update và insert.
      const toUpdate = payload.filter((p) => (p as any).id);
      const toInsert = payload.filter((p) => !(p as any).id);

      // Update theo id
      if (toUpdate.length > 0) {
        const chunk = 50;
        for (let i = 0; i < toUpdate.length; i += chunk) {
          const part = toUpdate.slice(i, i + chunk);
          const results = await Promise.all(
            part.map((r) => supabase.from(REPORTS_TABLE).update(r).eq('id', (r as any).id))
          );
          const err = results.find((x) => x.error)?.error;
          if (err) throw err;
        }
      }
      // Insert phần còn lại
      if (toInsert.length > 0) {
        const { error: insErr } = await supabase.from(REPORTS_TABLE).insert(toInsert);
        if (insErr) throw insErr;
      }

      {
        const okMsg = `Đã đồng bộ ${payload.length} dòng theo khóa Ngày + Code (cập nhật ad_cost, không ghi revenue).`;
        setExcelMsg(okMsg);
        try { window.alert(okMsg); } catch {}
      }
      setStagedReportRows([]);
    } catch (e) {
      const msg =
        e && typeof e === 'object' && 'message' in e ? String((e as any).message) : 'Đồng bộ thất bại (preview).';
      setExcelMsg(`Lỗi: ${msg}`);
      try {
        window.alert(`Đồng bộ thất bại: ${msg}`);
      } catch {}
    } finally {
      setExcelBusy(false);
    }
  }, [stagedReportRows, currentUserEmail]);

  const handlePushToDetailReports = useCallback(async () => {
    if (!currentUserEmail) {
      window.alert('Không xác định được email người đẩy. Vui lòng đăng nhập lại.');
      return;
    }
    // Chuẩn hoá dữ liệu: chỉ nhận dòng có ngày + code; key = report_date + code
    const prepared = rows
      .map((r) => {
        const report_date = String(r.ngay || '').slice(0, 10);
        const code = extractMaNvFromBracketPage(r.ten_quang_cao) || null;
        if (!report_date || !code) return null;
        return {
          report_date,
          code,
          // Các cột phụ (không bắt buộc)
          product:
            (Array.isArray(r.du_an) ? r.du_an?.[0]?.ten_du_an : r.du_an?.ten_du_an) || null,
          market: r.don_vi_tien_te || null,
          page: r.ten_quang_cao || null,
          ad_account: r.ten_tai_khoan || null,
          ad_cost: Number(r.so_tien_chi_tieu_vnd) || 0,
          mess_comment_count: Number(r.luot_tro_chuyen_tin_nhan) || 0,
          order_count: null as number | null,
          // KHÔNG đẩy doanh số
          // revenue: undefined,
          team: null as string | null,
          name:
            (Array.isArray(r.du_an) ? r.du_an?.[0]?.ten_du_an : r.du_an?.ten_du_an) ||
            'QC Excel',
          email: currentUserEmail,
        };
      })
      .filter(Boolean) as Array<{
        report_date: string;
        code: string;
        product: string | null;
        market: string | null;
        page: string | null;
        ad_account: string | null;
        ad_cost: number;
        mess_comment_count: number;
        order_count: number | null;
        team: string | null;
        name: string | null;
        email: string;
      }>;

    if (prepared.length === 0) {
      window.alert('Không có dòng nào có ngày hợp lệ để đẩy.');
      return;
    }

    if (!window.confirm(`Đẩy/ cập nhật ${prepared.length} dòng vào detail_reports (khóa Ngày + Code)?`)) return;

    setPushing(true);
    try {
      // Tìm bản ghi đã có theo (report_date, code) để update thay vì thêm mới
      const uniqueDays = Array.from(new Set(prepared.map((p) => p.report_date)));
      const uniqueCodes = Array.from(new Set(prepared.map((p) => p.code)));
      const { data: existing, error: selErr } = await supabase
        .from(REPORTS_TABLE)
        .select('id, report_date, code')
        .in('report_date', uniqueDays)
        .in('code', uniqueCodes);
      if (selErr) throw selErr;
      const idByKey = new Map<string, string>();
      for (const row of existing || []) {
        const k = `${(row as any).report_date}\0${(row as any).code}`;
        idByKey.set(k, (row as any).id);
      }

      const payload = prepared.map((p) => {
        const k = `${p.report_date}\0${p.code}`;
        const id = idByKey.get(k);
        return {
          ...(id ? { id } : {}),
          ...p,
        };
      });

      // Không dựa vào onConflict — tách update/insert như trên
      const toUpdate = payload.filter((p) => (p as any).id);
      const toInsert = payload.filter((p) => !(p as any).id);
      if (toUpdate.length > 0) {
        const chunk = 50;
        for (let i = 0; i < toUpdate.length; i += chunk) {
          const part = toUpdate.slice(i, i + chunk);
          const results = await Promise.all(
            part.map((r) => supabase.from(REPORTS_TABLE).update(r).eq('id', (r as any).id))
          );
          const err = results.find((x) => x.error)?.error;
          if (err) throw err;
        }
      }
      if (toInsert.length > 0) {
        const { error: insErr } = await supabase.from(REPORTS_TABLE).insert(toInsert);
        if (insErr) throw insErr;
      }

      {
        const okMsg = `Đã đồng bộ ${payload.length} dòng theo khóa Ngày + Code (cập nhật ad_cost, không ghi revenue). Nếu không thấy key trùng thì thêm dòng mới.`;
        setExcelMsg(okMsg);
        try { window.alert(okMsg); } catch {}
      }
      // Hiển thị danh sách đã đồng bộ
      setLastPushed(
        payload.map((p) => ({
          report_date: p.report_date,
          product: p.product,
          market: p.market,
          page: p.page,
          ad_account: p.ad_account,
          ad_cost: p.ad_cost,
          mess_comment_count: p.mess_comment_count,
          order_count: p.order_count,
          revenue: 0,
          team: p.team,
          name: p.name,
          email: p.email,
          code: p.code,
        }))
      );
    } catch (e) {
      const msg =
        e && typeof e === 'object' && 'message' in e ? String((e as any).message) : 'Đồng bộ thất bại.';
      setExcelMsg(`Lỗi: ${msg}`);
      try {
        window.alert(`Đồng bộ thất bại: ${msg}`);
      } catch {}
    } finally {
      setPushing(false);
    }
  }, [rows, currentUserEmail]);

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
            <button
              type="button"
              onClick={() => downloadMktReportExcelTemplate()}
              className="flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--bg2)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--text2)]"
              title="Mẫu Excel nhập trực tiếp vào detail_reports (giống MKT History)"
            >
              <Download size={13} />
              Mẫu Excel báo cáo
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
            <input
              ref={reportExcelRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => void handleUploadReportExcel(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => reportExcelRef.current?.click()}
              disabled={excelBusy}
              className="flex items-center gap-1.5 rounded-[6px] border border-[#10b981] px-2.5 py-1.5 text-[11px] font-bold text-[#34d399] disabled:opacity-50"
              title="Chọn Excel báo cáo để xem trước; sau đó bấm Đồng bộ để ghi vào detail_reports"
            >
              {excelBusy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              Tải lên báo cáo
            </button>
            <button
              type="button"
              onClick={() => void commitStagedReportRows()}
              disabled={excelBusy || !currentUserEmail || stagedReportRows.length === 0}
              className="flex items-center gap-1.5 rounded-[6px] border border-[#22c55e] px-2.5 py-1.5 text-[11px] font-bold text-[#86efac] disabled:opacity-50"
              title="Ghi các dòng báo cáo đang Preview vào detail_reports"
            >
              {excelBusy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              Đồng bộ báo cáo
            </button>
            <button
              type="button"
              onClick={() => void handlePushToDetailReports()}
              disabled={pushing || loading || rows.length === 0}
              className="flex items-center gap-1.5 rounded-[6px] border border-[#10b981] px-2.5 py-1.5 text-[11px] font-bold text-[#34d399] disabled:opacity-50"
              title="Đẩy các dòng đã lọc vào bảng detail_reports"
            >
              {pushing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              Đẩy vào detail_reports
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

      {lastPushed.length > 0 && (
        <SectionCard
          title="✅ Dòng vừa đẩy vào detail_reports"
          subtitle={`${lastPushed.length} dòng`}
          bodyPadding={false}
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[1000px] text-left">
              <thead>
                <tr className="border-b border-[var(--border)] text-[9px] font-extrabold uppercase tracking-wide text-[var(--text3)]">
                  <th className="p-2 whitespace-nowrap">Ngày</th>
                  <th className="p-2">Code</th>
                  <th className="p-2 text-right">Chi tiêu</th>
                  <th className="p-2 text-right">Doanh số</th>
                  <th className="p-2">Email</th>
                </tr>
              </thead>
              <tbody className="text-[11px] text-[var(--text2)] font-[var(--mono)]">
                {lastPushed.map((r, i) => (
                  <tr key={`${r.report_date}-${r.email}-${r.page || ''}-${i}`} className="border-b border-[rgba(255,255,255,0.04)]">
                    <td className="p-2 whitespace-nowrap">{formatReportDateVi(r.report_date)}</td>
                    <td className="p-2 max-w-[140px] truncate" title={r.code || ''}>
                      {r.code || '—'}
                    </td>
                    <td className="p-2 text-right">{formatCompactVnd(r.ad_cost)}</td>
                    <td className="p-2 text-right">{formatCompactVnd(r.revenue)}</td>
                    <td className="p-2">{r.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {stagedReportRows.length > 0 && (
        <SectionCard
          title="👀 Preview báo cáo sẽ đồng bộ"
          subtitle={`${stagedReportRows.length} dòng`}
          bodyPadding={false}
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[1000px] text-left">
              <thead>
                <tr className="border-b border-[var(--border)] text-[9px] font-extrabold uppercase tracking-wide text-[var(--text3)]">
                  <th className="p-2 whitespace-nowrap">Ngày</th>
                  <th className="p-2">Code</th>
                  <th className="p-2 text-right">Chi tiêu</th>
                  <th className="p-2 text-right">Doanh số</th>
                  <th className="p-2 text-right">Mess</th>
                  <th className="p-2 text-right">Đơn</th>
                  <th className="p-2 text-right">Lead</th>
                </tr>
              </thead>
              <tbody className="text-[11px] text-[var(--text2)] font-[var(--mono)]">
                {stagedReportRows.map((r, i) => (
                  <tr key={`${r.report_date}-${r.page || ''}-${i}`} className="border-b border-[rgba(255,255,255,0.04)]">
                    <td className="p-2 whitespace-nowrap">{formatReportDateVi(r.report_date)}</td>
                    <td className="p-2 max-w-[120px] truncate" title={extractMaNvFromBracketPage(r.page || '') || ''}>
                      {extractMaNvFromBracketPage(r.page || '') || '—'}
                    </td>
                    <td className="p-2 text-right">{formatCompactVnd(r.ad_cost)}</td>
                    <td className="p-2 text-right">{formatCompactVnd(r.revenue)}</td>
                    <td className="p-2 text-right">{r.mess_comment_count}</td>
                    <td className="p-2 text-right">{r.order_count}</td>
                    <td className="p-2 text-right">{r.tong_lead}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
};
