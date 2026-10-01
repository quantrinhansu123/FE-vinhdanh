import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  fetchUpcareMktEmployees,
  getUpcareProjectScopeForUi,
  isUpcareMktConfigured,
  isUpcareOauthRefreshConfigured,
  type UpcareMktEmployeeRow,
} from '../../../api/upcareCrm';
import { supabase } from '../../../api/supabase';
import { fetchAllRows } from '../../../api/fetchAllRows';
import { isMissingTienVietError } from '../../../utils/detailReportsVnd';
import { normalizeMaNsCode, REPORTS_TABLE, toLocalYyyyMmDd } from '../../dashboard/mkt/mktDetailReportShared';

/** Fabico MKT → detail_reports: cập nhật doanh thu + số đơn (không đụng name/email/code/report_date). */
type UpcareReportsPatch = { revenue: number; tien_viet: number; order_count: number };
type UpcareDailyEmployeeRow = UpcareMktEmployeeRow & { reportDate: string };
import { downloadMktReportExcelTemplate } from '../../dashboard/mkt/mktHistoryExcel';

/** Gộp trùng mã trong cùng ngày; không cộng lẫn số liệu giữa các ngày. */
function aggregateUpcareRowsBySameCode(list: UpcareDailyEmployeeRow[]): UpcareDailyEmployeeRow[] {
  const m = new Map<string, UpcareDailyEmployeeRow>();
  for (const r of list) {
    const c = String(r.code).trim();
    const key = `${r.reportDate}\0${normalizeMaNsCode(c)}`;
    const prev = m.get(key);
    if (prev) {
      prev.amount = (Number(prev.amount) || 0) + (Number(r.amount) || 0);
      prev.count = (Number(prev.count) || 0) + (Number(r.count) || 0);
      if (!prev.name?.trim() && r.name?.trim()) prev.name = r.name;
    } else {
      m.set(key, { ...r, code: c, amount: Number(r.amount) || 0, count: Number(r.count) || 0 });
    }
  }
  return Array.from(m.values());
}

function defaultDate(): string {
  return toLocalYyyyMmDd(new Date());
}

function formatAmount(n: number): string {
  return n.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function normalizeReportDate(value: unknown): string {
  return String(value ?? '').trim().slice(0, 10);
}

function nextReportDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + 1);
  return toLocalYyyyMmDd(date);
}

export const UpcareMktEmployeesView: React.FC = () => {
  const initialDate = useMemo(() => defaultDate(), []);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [loadedDate, setLoadedDate] = useState<string | null>(null);
  const [rows, setRows] = useState<UpcareDailyEmployeeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const configured = isUpcareMktConfigured();

  const load = useCallback(async () => {
    if (!isUpcareMktConfigured()) return;
    setLoading(true);
    setError(null);
    try {
      if (!selectedDate) throw new Error('Vui lòng chọn ngày cần tải.');
      const daily = await fetchUpcareMktEmployees({ dateFrom: selectedDate, dateTo: selectedDate });
      const sorted = daily
        .map((row) => ({ ...row, reportDate: selectedDate }))
        .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0));
      setRows(sorted);
      setLoadedDate(selectedDate);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không tải được dữ liệu.';
      setError(msg);
      setRows([]);
      setLoadedDate(null);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  // Không tự tải khi mở trang; chỉ tải khi người dùng bấm nút

  useEffect(() => {
    const prev = document.title;
    document.title = 'MKT Fabico API | CRM';
    return () => {
      document.title = prev;
    };
  }, []);

  const proxyOn = true;
  const oauthRefreshOn = useMemo(() => isUpcareOauthRefreshConfigured(), []);
  const { param: projectParam, uuid: projectUuid } = useMemo(() => getUpcareProjectScopeForUi(), []);

  const apiUrl = useMemo(() => {
    const qs = new URLSearchParams({ date_from: selectedDate, date_to: selectedDate });
    if (projectUuid) qs.set(projectParam, projectUuid);
    return `/api/upcare-crm?${qs.toString()}`;
  }, [selectedDate, projectParam, projectUuid]);

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

  const pushToDetailReports = useCallback(async () => {
    if (!rows.length) return;
    if (!currentUserEmail) {
      setError('Không xác định được email người đẩy. Vui lòng đăng nhập lại.');
      return;
    }
    setSaving(true);
    try {
      if (!selectedDate || loadedDate !== selectedDate) {
        setError('Hãy tải dữ liệu lại cho ngày đang chọn trước khi đẩy.');
        return;
      }
      const reportDate = normalizeReportDate(selectedDate);
      const nextDate = nextReportDate(reportDate);

      // Chỉ đẩy dòng có mã (code); không có mã thì bỏ qua hoàn toàn
      const rowsWithCode = rows.filter((r) => {
        const c = r.code != null ? String(r.code).trim() : '';
        return c.length > 0;
      });
      const skippedNoCode = rows.length - rowsWithCode.length;
      if (rowsWithCode.length === 0) {
        try {
          window.alert(
            'Không có dòng nào có mã (Code). Chỉ đồng bộ khi có đủ Ngày (theo khoảng đã chọn) và Mã nhân sự.'
          );
        } catch {}
        return;
      }

      const rowsAggregated = aggregateUpcareRowsBySameCode(rowsWithCode);
      const mergedSameCodeOnPage = rowsWithCode.length - rowsAggregated.length;

      // Lấy các bản ghi đã có trong DB theo (report_date, code)
      const { data: existing, error: selErr } = await fetchAllRows<{ id: string; report_date: string; code: string | null }>(
        supabase.from(REPORTS_TABLE)
          .select('id, report_date, code')
          .gte('report_date', reportDate)
          .lt('report_date', nextDate)
      );
      if (selErr) throw selErr;

      const idByKey = new Map<string, string>();
      for (const row of existing || []) {
        const dateKey = normalizeReportDate(row.report_date);
        const codeKey = normalizeMaNsCode(row.code);
        const k = `${dateKey}\0${codeKey}`;
        if (row.id && dateKey && codeKey && !idByKey.has(k)) idByKey.set(k, row.id);
      }

      // Chỉ cập nhật bản ghi đã có trùng (report_date, code); không insert dòng mới
      type RowUp = { id: string; patch: UpcareReportsPatch };
      const toUpdate: RowUp[] = [];
      let skippedNoDbRow = 0;
      const unmatchedPairs: string[] = [];

      for (const r of rowsAggregated) {
        const ymd = normalizeReportDate(r.reportDate);
        if (ymd !== reportDate) continue;
        const c = String(r.code).trim();
        const k = `${ymd}\0${normalizeMaNsCode(c)}`;
        const id = idByKey.get(k);
        if (!id) {
          skippedNoDbRow += 1;
          unmatchedPairs.push(`${ymd} + ${c}`);
          continue;
        }
        const amt = Number(r.amount) || 0;
        toUpdate.push({
          id,
          patch: {
            revenue: amt,
            tien_viet: Math.round(amt * 25000),
            order_count: Number(r.count) || 0,
          },
        });
      }

      if (toUpdate.length === 0) {
        window.alert(
          `Kh\u00f4ng c\u1eadp nh\u1eadt \u0111\u01b0\u1ee3c d\u00f2ng n\u00e0o cho ng\u00e0y ${reportDate}. Kh\u00f4ng t\u00ecm th\u1ea5y c\u1eb7p Ng\u00e0y + M\u00e3 NV trong detail_reports: ${Array.from(new Set(unmatchedPairs)).join('; ') || 'kh\u00f4ng c\u00f3 m\u00e3 kh\u1edbp'}.`
        );
        return;
      }

      const chunk = 80;
      for (let i = 0; i < toUpdate.length; i += chunk) {
        const part = toUpdate.slice(i, i + chunk);
        const results = await Promise.all(
          part.map(({ id, patch }) =>
            supabase.from(REPORTS_TABLE).update(patch).eq('id', id)
          )
        );
        let err = results.find((x) => x.error)?.error;
        // DB chưa có cột tien_viet -> thử lại chỉ với revenue.
        if (err && isMissingTienVietError(err)) {
          const retry = await Promise.all(
            part.map(({ id, patch }) =>
              supabase.from(REPORTS_TABLE).update({ revenue: patch.revenue }).eq('id', id)
            )
          );
          err = retry.find((x) => x.error)?.error;
          if (!err) {
            setError(
              'Đã lưu revenue (thiếu cột tien_viet nên chưa lưu VND). Hãy chạy supabase/alter_detail_reports_tien_viet.sql.'
            );
          }
        }
        if (err) throw err;
      }
      setError(null);

      const tailNoCode =
        skippedNoCode > 0 ? ` Đã bỏ qua ${skippedNoCode} dòng không có mã.` : '';
      const tailMerge =
        mergedSameCodeOnPage > 0
          ? ` Đã cộng gộp ${mergedSameCodeOnPage} dòng trùng mã trong cùng ngày trước khi đẩy.`
          : '';
      const tailSkip =
        skippedNoDbRow > 0
          ? ` ${skippedNoDbRow} cặp (ngày+mã) không có trong detail_reports — bỏ qua (không thêm dòng): ${Array.from(new Set(unmatchedPairs)).join('; ')}.`
          : '';
      const okMsg = `Đã cập nhật ${toUpdate.length} bản ghi đúng theo ngày trong detail_reports (cột revenue, tien_viet, order_count).${tailNoCode}${tailMerge}${tailSkip}`;
      try { window.alert(okMsg); } catch {}
      // Ẩn dữ liệu source sau khi đẩy
      setRows([]);
      setLoadedDate(null);
    } catch (e) {
      const raw = e && typeof e === 'object' && 'message' in e ? String((e as any).message) : 'Ghi dữ liệu thất bại.';
      setError(
        isMissingTienVietError(raw)
          ? `${raw} — Hãy chạy supabase/alter_detail_reports_tien_viet.sql để tạo cột tien_viet.`
          : raw
      );
    } finally {
      setSaving(false);
    }
  }, [rows, selectedDate, loadedDate, currentUserEmail]);

  return (
    <div className="-m-3 min-h-[calc(100vh-5.5rem)] bg-[#070d1f] p-6 font-[Inter,sans-serif] text-[#dfe4fe] sm:p-8 ag-prism-scroll">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[#dfe4fe] sm:text-3xl">Marketing — Fabico CRM</h2>
            <p className="mt-1 text-sm text-[#a5aac2]">
              GET <code className="rounded bg-[#11192e] px-1.5 py-0.5 text-xs text-[#3bbffa]">/api/employee/mkt</code>
              {proxyOn ? (
                <span className="ml-2 text-[#69f6b8]">(server proxy: /api/upcare-crm)</span>
              ) : null}
            </p>
                <p className="mt-1 text-xs text-[#a5aac2]">
                  URL hiện tại:{' '}
                  <a
                    href={apiUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-[#3bbffa] hover:underline"
                    title="Mở API với khoảng ngày đã chọn"
                  >
                    {apiUrl}
                  </a>
                </p>
            {projectUuid ? (
              <p className="mt-1 text-xs text-[#a5aac2]">
                Scope: <code className="text-[#3bbffa]">{projectParam}</code>={projectUuid}
              </p>
            ) : (
              <p className="mt-1 text-xs text-[#a5aac2]">Không gửi project scope (env PROJECT_UUID=none).</p>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-[#a5aac2]">
              Ngày báo cáo
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setRows([]);
                  setLoadedDate(null);
                  setError(null);
                }}
                className="rounded-lg border-none bg-[#0c1326] px-3 py-2 text-sm text-[#dfe4fe] ring-1 ring-[#41475b]/30 focus:outline-none focus:ring-[#3bbffa]/50"
              />
            </label>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading || !configured}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-[#3bbffa] to-[#22b1ec] px-5 py-2.5 text-sm font-bold text-[#002b3d] shadow-lg shadow-[#3bbffa]/15 transition-all hover:brightness-110 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Tải dữ liệu
            </button>
            <button
              type="button"
              onClick={() => downloadMktReportExcelTemplate()}
              className="flex items-center gap-2 rounded-lg border border-[#41475b]/40 bg-[#0c1326] px-5 py-2.5 text-sm font-bold text-[#a5aac2] hover:bg-[#11192e]"
              title="Tải mẫu Excel nhập báo cáo MKT"
            >
              Tải mẫu Excel
            </button>
            <button
              type="button"
              onClick={() => void pushToDetailReports()}
              disabled={saving || loading || rows.length === 0 || loadedDate !== selectedDate}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-[#69f6b8] to-[#4de2a2] px-5 py-2.5 text-sm font-bold text-[#013828] shadow-lg shadow-[#69f6b8]/15 transition-all hover:brightness-110 disabled:opacity-50"
              title="Gọi Upcare riêng cho từng ngày. Chỉ cập nhật bản ghi đã có trong detail_reports trùng ngày + mã; không tạo dòng mới."
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Đẩy vào detail_reports
            </button>
          </div>
        </div>

        {!configured ? (
          <div className="rounded-xl border border-[#f8a010]/30 bg-[#f8a010]/10 p-5 text-sm text-[#ffb148]">
            <p className="font-semibold">Upcare server proxy is disabled.</p>
            <p className="mt-2 text-[#dfe4fe]/90">
              Enable <code className="text-[#3bbffa]">VITE_UPCARE_CRM_ENABLED=true</code> in .env.local and restart the dev server.
              Keep credentials in server-only <code className="text-[#3bbffa]">UPCARE_CRM_*</code> variables; do not use a VITE_ prefix for passwords.
            </p>
          </div>
        ) : (
          <p className="text-xs text-[#69f6b8]">
            Upcare server-side proxy is enabled. Credentials stay on the server.
            {oauthRefreshOn ? (
              <span className="ml-2 text-[#a5aac2]">
                Tự động lấy token mới khi sắp hết hạn hoặc khi CRM trả 401.
              </span>
            ) : null}
          </p>
        )}

        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</div>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-[#41475b]/20 bg-[#0c1326] shadow-xl">
          <div className="border-b border-[#41475b]/15 px-4 py-3 sm:px-6">
            <p className="text-xs text-[#a5aac2]">
              {loading ? 'Đang tải…' : `${rows.length} nhân sự MKT trong ngày ${loadedDate || selectedDate} (sắp xếp theo amount giảm dần)`}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#41475b]/15 text-xs font-bold uppercase tracking-wider text-[#a5aac2]">
                  <th className="px-4 py-3 sm:px-6">#</th>
                  <th className="px-4 py-3 sm:px-6">Ảnh</th>
                  <th className="px-4 py-3 sm:px-6">ID</th>
                  <th className="px-4 py-3 sm:px-6">Code</th>
                  <th className="px-4 py-3 sm:px-6">Tên</th>
                  <th className="px-4 py-3 text-right sm:px-6">Số đơn</th>
                  <th className="px-4 py-3 text-right sm:px-6">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#41475b]/10">
                {loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-[#a5aac2]">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Đang tải…
                      </span>
                    </td>
                  </tr>
                ) : null}
                {!loading && configured && rows.length === 0 && !error ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-[#a5aac2]">
                      Không có bản ghi. Chọn khoảng ngày và bấm Tải dữ liệu.
                    </td>
                  </tr>
                ) : null}
                {rows.map((row, idx) => (
                  <tr key={row.id} className="bg-[#11192e]/50 transition-colors hover:bg-[#171f36]">
                    <td className="px-4 py-3 tabular-nums text-[#a5aac2] sm:px-6">{idx + 1}</td>
                    <td className="px-4 py-3 sm:px-6">
                      {row.avatar ? (
                        <img
                          src={row.avatar}
                          alt=""
                          className="h-10 w-10 rounded-lg border border-[#41475b]/30 object-cover"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#222b47] text-xs font-bold text-[#a5aac2]">
                          ?
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[#3bbffa] sm:px-6">{row.id}</td>
                    <td className="px-4 py-3 font-mono text-[#a5aac2] sm:px-6">
                      {row.code == null ? '—' : String(row.code).trim() || '—'}
                    </td>
                    <td className="max-w-[280px] px-4 py-3 font-medium text-[#dfe4fe] sm:px-6">
                      <span className="line-clamp-2" title={row.name}>
                        {row.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-[#a5aac2] sm:px-6">
                      {(Number(row.count) || 0).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-[#69f6b8] sm:px-6">
                      {formatAmount(Number(row.amount) || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
