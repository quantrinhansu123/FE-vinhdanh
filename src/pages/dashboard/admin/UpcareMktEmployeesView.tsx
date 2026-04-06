import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  fetchUpcareMktEmployees,
  getUpcareProjectScopeForUi,
  isUpcareMktConfigured,
  isUpcareOauthRefreshConfigured,
  upcareBearerStatus,
  type UpcareMktEmployeeRow,
} from '../../../api/upcareCrm';
import { supabase } from '../../../api/supabase';
import { REPORTS_TABLE, toLocalYyyyMmDd } from '../../dashboard/mkt/mktDetailReportShared';
import { downloadMktReportExcelTemplate } from '../../dashboard/mkt/mktHistoryExcel';

function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 6);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function formatAmount(n: number): string {
  return n.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export const UpcareMktEmployeesView: React.FC = () => {
  const initial = useMemo(() => defaultDateRange(), []);
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const [rows, setRows] = useState<UpcareMktEmployeeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const configured = isUpcareMktConfigured();
  const bearerInfo = upcareBearerStatus();

  const load = useCallback(async () => {
    if (!isUpcareMktConfigured()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUpcareMktEmployees({ dateFrom, dateTo });
      const sorted = [...data].sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
      setRows(sorted);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không tải được dữ liệu.';
      setError(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  // Không tự tải khi mở trang; chỉ tải khi người dùng bấm nút

  useEffect(() => {
    const prev = document.title;
    document.title = 'MKT Upcare API | CRM';
    return () => {
      document.title = prev;
    };
  }, []);

  const proxyOn = import.meta.env.VITE_UPCARE_CRM_USE_PROXY === 'true';
  const oauthRefreshOn = useMemo(() => isUpcareOauthRefreshConfigured(), []);
  const { param: projectParam, uuid: projectUuid } = useMemo(() => getUpcareProjectScopeForUi(), []);

  const apiUrl = useMemo(() => {
    const base =
      import.meta.env.VITE_UPCARE_CRM_USE_PROXY === 'true'
        ? '/upcare-crm'
        : (import.meta.env.VITE_UPCARE_CRM_API_BASE?.trim() || 'https://crm.upcare.asia').replace(/\/$/, '');
    const qs = new URLSearchParams({
      date_from: dateFrom,
      date_to: dateTo,
    });
    if (projectUuid) {
      qs.set(projectParam, projectUuid);
    }
    return `${base}/api/employee/mkt?${qs.toString()}`;
  }, [dateFrom, dateTo, projectParam, projectUuid]);

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

  const buildInclusiveDays = useCallback((): string[] => {
    const days: string[] = [];
    const s = new Date(dateFrom);
    const e = new Date(dateTo);
    const cur = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    const end = new Date(e.getFullYear(), e.getMonth(), e.getDate());
    while (cur <= end) {
      days.push(toLocalYyyyMmDd(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }, [dateFrom, dateTo]);

  const pushToDetailReports = useCallback(async () => {
    if (!rows.length) return;
    if (!currentUserEmail) {
      setError('Không xác định được email người đẩy. Vui lòng đăng nhập lại.');
      return;
    }
    setSaving(true);
    try {
      const dayKeys = buildInclusiveDays();

      // Chỉ đồng bộ những hàng có code hợp lệ
      const codes = Array.from(
        new Set(
          rows
            .map((r) => (r.code != null ? String(r.code).trim() : ''))
            .filter((s) => s.length > 0)
        )
      );

      if (codes.length === 0) {
        setSaving(false);
        return;
      }

      // Lấy các bản ghi đã có trong DB theo (report_date, code)
      const { data: existing, error: selErr } = await supabase
        .from(REPORTS_TABLE)
        .select('id, report_date, code')
        .in('report_date', dayKeys)
        .in('code', codes);
      if (selErr) throw selErr;

      const idByKey = new Map<string, string>();
      for (const row of existing || []) {
        const k = `${row.report_date}\0${(row as any).code}`;
        idByKey.set(k, (row as any).id);
      }

      // Gộp trùng (report_date, code) trong chính payload — cộng revenue để tránh vi phạm unique
      type UpItem = {
        id?: string;
        report_date: string;
        name: string;
        revenue: number;
        tien_viet: number;
        code: string;
        email: string;
      };
      const merged = new Map<string, UpItem>();

      for (const ymd of dayKeys) {
        for (const r of rows) {
          const c = r.code != null ? String(r.code).trim() : '';
          if (!c) continue;
          const k = `${ymd}\0${c}`;
          const existingItem = merged.get(k);
          const amt = Number(r.amount) || 0;
          if (existingItem) {
            existingItem.revenue += amt;
            existingItem.tien_viet += Math.round(amt * 25000);
            if (!existingItem.name && r.name) existingItem.name = r.name;
          } else {
            merged.set(k, {
              ...(idByKey.has(k) ? { id: idByKey.get(k) } : {}),
              report_date: ymd,
              name: r.name,
              revenue: amt,
              tien_viet: Math.round(amt * 25000),
              code: c,
              email: currentUserEmail,
            });
          }
        }
      }

      const payload = Array.from(merged.values());

      // Không phụ thuộc onConflict; tách update/insert theo id
      const toUpdate = payload.filter((p) => (p as any).id);
      const toInsert = payload.filter((p) => !(p as any).id);

      if (toUpdate.length > 0) {
        const chunk = 80;
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
      setError(null);

      const okMsg = `Đã đẩy ${payload.length} dòng vào detail_reports theo Ngày + Code.`;
      try { window.alert(okMsg); } catch {}
      // Ẩn dữ liệu source sau khi đẩy
      setRows([]);
    } catch (e) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as any).message) : 'Ghi dữ liệu thất bại.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }, [rows, buildInclusiveDays]);

  return (
    <div className="-m-3 min-h-[calc(100vh-5.5rem)] bg-[#070d1f] p-6 font-[Inter,sans-serif] text-[#dfe4fe] sm:p-8 ag-prism-scroll">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[#dfe4fe] sm:text-3xl">Marketing — Upcare CRM</h2>
            <p className="mt-1 text-sm text-[#a5aac2]">
              GET <code className="rounded bg-[#11192e] px-1.5 py-0.5 text-xs text-[#3bbffa]">/api/employee/mkt</code>
              {proxyOn ? (
                <span className="ml-2 text-[#69f6b8]">(proxy dev: /upcare-crm)</span>
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
              Từ ngày
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border-none bg-[#0c1326] px-3 py-2 text-sm text-[#dfe4fe] ring-1 ring-[#41475b]/30 focus:outline-none focus:ring-[#3bbffa]/50"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-[#a5aac2]">
              Đến ngày
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
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
              disabled={saving || loading || rows.length === 0}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-[#69f6b8] to-[#4de2a2] px-5 py-2.5 text-sm font-bold text-[#013828] shadow-lg shadow-[#69f6b8]/15 transition-all hover:brightness-110 disabled:opacity-50"
              title="Ghi vào bảng detail_reports theo từng ngày trong khoảng đã chọn (upsert theo report_date + code)"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Đẩy vào detail_reports
            </button>
          </div>
        </div>

        {!configured ? (
          <div className="rounded-xl border border-[#f8a010]/30 bg-[#f8a010]/10 p-5 text-sm text-[#ffb148]">
            <p className="font-semibold">Chưa có Bearer token (hoặc Vite chưa nạp .env)</p>
            {bearerInfo.ok === false && bearerInfo.hint === 'missing' ? (
              <p className="mt-2 text-[#dfe4fe]/90">
                Không thấy biến <code className="text-[#3bbffa]">VITE_UPCARE_CRM_BEARER_TOKEN</code> trong bundle — thường do{' '}
                <strong className="text-[#ffb148]">thiếu tiền tố VITE_</strong>, sai tên biến, hoặc file{' '}
                <code className="text-[#3bbffa]">.env</code> không nằm ở thư mục gốc project (cùng cấp{' '}
                <code className="text-[#3bbffa]">package.json</code>). Sau khi sửa .env:{' '}
                <strong className="text-[#ffb148]">tắt và chạy lại npm run dev</strong>.
              </p>
            ) : (
              <p className="mt-2 text-[#dfe4fe]/90">
                Biến đã khai báo nhưng giá trị sau khi xử lý vẫn trống — kiểm tra không để dòng trống, hoặc bỏ dấu{' '}
                <code className="text-[#3bbffa]">Bearer </code> (app sẽ tự thêm). Có thể dùng{' '}
                <code className="text-[#3bbffa]">VITE_UPCARE_API_TOKEN</code> thay thế.
              </p>
            )}
            <p className="mt-2 text-[#dfe4fe]/90">
              Thêm vào <code className="text-[#3bbffa]">.env.local</code> (một dòng, không cần chữ Bearer):
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-3 text-xs text-[#a5aac2]">
              {`VITE_UPCARE_CRM_BEARER_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_UPCARE_CRM_USE_PROXY=true`}
            </pre>
            <p className="mt-3 text-xs text-[#a5aac2]">
              Dự phòng tên biến: <code className="text-[#3bbffa]">VITE_UPCARE_API_TOKEN</code>. Nếu <strong>401</strong>: lấy JWT
              mới hoặc dán <code className="text-[#3bbffa]">VITE_UPCARE_CRM_COOKIE</code> (full Cookie từ trình duyệt). Production:{' '}
              <code className="text-[#3bbffa]">npm run build</code> sau khi đặt biến.
            </p>
          </div>
        ) : (
          <p className="text-xs text-[#69f6b8]">
            Bearer đã cấu hình
            {bearerInfo.ok ? ` (${bearerInfo.length} ký tự).` : '.'}
            {oauthRefreshOn ? (
              <span className="ml-2 text-[#a5aac2]">
                · 401 sẽ thử refresh qua <code className="text-[#3bbffa]">/api/oauth/token</code>
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
              {loading ? 'Đang tải…' : `${rows.length} nhân sự MKT (sắp xếp theo amount giảm dần)`}
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
                  <th className="px-4 py-3 text-right sm:px-6">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#41475b]/10">
                {loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-[#a5aac2]">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Đang tải…
                      </span>
                    </td>
                  </tr>
                ) : null}
                {!loading && configured && rows.length === 0 && !error ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-[#a5aac2]">
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
