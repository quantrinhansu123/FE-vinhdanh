import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Loader2, RefreshCw } from 'lucide-react';
import { SectionCard } from '../../../components/crm-dashboard/atoms/SharedAtoms';
import { getMetaQcAccounts, loginMetaQc, MetaQcError } from '../../../api/metaQc';
import { formatFullVnd, formatReportDateVi } from '../mkt/mktDetailReportShared';

type MetaQcRow = {
  accountId: string;
  date: string;
  employeeCode: string | null;
  campaignName: string;
  spendVnd: number;
  conversations: number;
};

type MetaQcResponse = {
  rows?: MetaQcRow[];
  accountIds?: string[];
  skippedCurrencies?: string[];
  message?: string;
};

type MetaDetailSyncResponse = {
  sourceRowsSaved?: number;
  detailRowsSynced?: number;
  unmatchedEmployeeCodes?: string[];
  rowsWithoutEmployeeCode?: number;
  datesNotReset?: string[];
  skippedCurrencies?: string[];
  message?: string;
};

const PAGE_SIZE = 50;

function toYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const MetaAdsView: React.FC = () => {
  const today = toYmd(new Date());
  const [draftFrom, setDraftFrom] = useState(today);
  const [draftTo, setDraftTo] = useState(today);
  const [applied, setApplied] = useState({ from: today, to: today });
  const [rows, setRows] = useState<MetaQcRow[]>([]);
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [skippedCurrencies, setSkippedCurrencies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fe_vinhdanh_auth_user') || '{}').email || ''; } catch { return ''; }
  });
  const [loginPassword, setLoginPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loadedRange, setLoadedRange] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const loadVersion = useRef(0);

  const loadMetaRows = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setError(null);
    setLoadedRange(null);
    setSyncMessage(null);
    try {
      const params = new URLSearchParams({ from: applied.from, to: applied.to });
      const response = await fetch(`/api/meta-project-qc?${params.toString()}`, {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { 'X-Meta-QC-Request': '1' },
      });
      const payload = await response.json() as MetaQcResponse;
      if (response.status === 401) {
        if (version === loadVersion.current) {
          setNeedsLogin(true);
          setRows([]);
          setAccountIds([]);
          setLoading(false);
        }
        return;
      }
      if (!response.ok) throw new Error(payload.message || 'Không tải được dữ liệu Facebook Ads.');
      if (version !== loadVersion.current) return;
      setNeedsLogin(false);
      setRows(Array.isArray(payload.rows) ? payload.rows : []);
      setAccountIds(Array.isArray(payload.accountIds) ? payload.accountIds : []);
      setSkippedCurrencies(Array.isArray(payload.skippedCurrencies) ? payload.skippedCurrencies : []);
      setLoadedRange(`${applied.from}:${applied.to}`);
      setPage(1);
    } catch (loadError) {
      if (version !== loadVersion.current) return;
      setError(loadError instanceof Error ? loadError.message : 'Không tải được dữ liệu Facebook Ads.');
      setRows([]);
      setAccountIds([]);
      setSkippedCurrencies([]);
      setLoadedRange(null);
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [applied]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      void loadMetaRows();
      return;
    }
    let active = true;
    getMetaQcAccounts().then(() => {
      if (active) void loadMetaRows();
    }).catch((authError) => {
      if (!active) return;
      if (authError instanceof MetaQcError && authError.status === 401) setNeedsLogin(true);
      else setError(authError instanceof Error ? authError.message : 'Không xác thực được tài khoản CRM.');
      setLoading(false);
    });
    return () => { active = false; };
  }, [loadMetaRows]);

  const totalSpend = useMemo(
    () => rows.reduce((sum, row) => sum + (Number(row.spendVnd) || 0), 0),
    [rows],
  );
  const totalConversations = useMemo(
    () => rows.reduce((sum, row) => sum + (Number(row.conversations) || 0), 0),
    [rows],
  );
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const loadSelectedRange = () => {
    if (!draftFrom || !draftTo || draftFrom > draftTo) {
      setError('Từ ngày phải nhỏ hơn hoặc bằng Đến ngày.');
      return;
    }
    if (draftFrom === applied.from && draftTo === applied.to) {
      void loadMetaRows();
      return;
    }
    setLoadedRange(null);
    setSyncMessage(null);
    setApplied({ from: draftFrom, to: draftTo });
  };

  const syncToDetailReports = async () => {
    if (loadedRange !== `${applied.from}:${applied.to}` || draftFrom !== applied.from || draftTo !== applied.to || syncing) return;
    setSyncing(true);
    setSyncMessage(null);
    setError(null);
    try {
      const response = await fetch('/api/meta-project-qc?action=sync-detail-reports', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: {
          'X-Meta-QC-Request': '1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: applied.from, to: applied.to }),
        signal: AbortSignal.timeout(65000),
      });
      const payload = await response.json() as MetaDetailSyncResponse;
      if (response.status === 401) {
        setNeedsLogin(true);
        throw new Error('Phiên xác nhận Meta đã hết hạn. Hãy xác nhận tài khoản quản trị rồi đồng bộ lại.');
      }
      if (!response.ok) throw new Error(payload.message || 'Không đồng bộ được Meta vào detail_reports.');

      const notes = [
        `Đã lưu ${Number(payload.sourceRowsSaved) || 0} dòng Meta vào Supabase`,
        `đã cập nhật ${Number(payload.detailRowsSynced) || 0} dòng nhân viên/ngày trong detail_reports.`,
      ];
      const unmatched = payload.unmatchedEmployeeCodes || [];
      if (unmatched.length) notes.push(`Chưa khớp mã nhân viên: ${unmatched.join(', ')}.`);
      if (payload.rowsWithoutEmployeeCode) notes.push(`Bỏ qua ${payload.rowsWithoutEmployeeCode} dòng Meta không có mã nhân viên.`);
      if (payload.datesNotReset?.length) notes.push(`Giữ số Meta cũ ở ngày chưa đối chiếu đủ: ${payload.datesNotReset.join(', ')}.`);
      if (payload.skippedCurrencies?.length) notes.push(`Bỏ qua tiền tệ ${payload.skippedCurrencies.join(', ')}; giữ số Meta cũ trong khoảng này để tránh xóa thiếu dữ liệu.`);
      setSyncMessage(notes.join(' '));
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Không đồng bộ được Meta vào detail_reports.');
    } finally {
      setSyncing(false);
    }
  };

  const authenticate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loginBusy) return;
    setLoginBusy(true);
    setLoginError('');
    try {
      await loginMetaQc(loginEmail, loginPassword);
      setLoginPassword('');
      setNeedsLogin(false);
      await loadMetaRows();
    } catch (authError) {
      setLoginError(authError instanceof Error ? authError.message : 'Không xác thực được tài khoản CRM.');
    } finally {
      setLoginBusy(false);
    }
  };

  return (
    <div className="dash-fade-up">
      <SectionCard
        title="Dữ liệu QC từ Meta"
        subtitle={`${rows.length.toLocaleString('vi-VN')} dòng · ${formatReportDateVi(applied.from)} → ${formatReportDateVi(applied.to)}`}
        bodyPadding={false}
      >
        <div className="space-y-4 p-4 text-[var(--text)]">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[138px] flex-col gap-1 text-xs">
              Từ ngày
              <input
                type="date"
                value={draftFrom}
                onChange={(event) => setDraftFrom(event.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg3)] p-2"
              />
            </label>
            <label className="flex min-w-[138px] flex-col gap-1 text-xs">
              Đến ngày
              <input
                type="date"
                value={draftTo}
                onChange={(event) => setDraftTo(event.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg3)] p-2"
              />
            </label>
            <button
              type="button"
              onClick={loadSelectedRange}
              disabled={loading || needsLogin}
              className="flex items-center gap-2 rounded-lg bg-[#1877f2] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {loading ? 'Đang lấy dữ liệu…' : 'Lấy từ API Meta'}
            </button>
            <button
              type="button"
              onClick={() => void syncToDetailReports()}
              disabled={loading || syncing || needsLogin || draftFrom !== applied.from || draftTo !== applied.to || loadedRange !== `${applied.from}:${applied.to}`}
              className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
              title="Lưu snapshot Meta vào Supabase server rồi tổng hợp theo ngày + mã nhân viên vào detail_reports."
            >
              {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {syncing ? 'Đang đồng bộ…' : 'Đồng bộ Meta → detail_reports'}
            </button>
          </div>

          <p className="text-xs leading-relaxed text-[var(--text3)]">
            Bước 1: đồng bộ Meta sẽ lưu chi tiết chiến dịch/ngày vào Supabase server, sau đó cộng chi phí và trò chuyện theo mã nhân viên/ngày vào detail_reports. Tiếp theo, dùng trang MKT Fabico để bổ sung doanh thu, số đơn và data từ Odoo vào đúng dòng đó.
          </p>

          {needsLogin && (
            <form onSubmit={(event) => void authenticate(event)} className="max-w-[420px] space-y-3 rounded-lg border border-[var(--border)] bg-[var(--bg3)] p-4">
              <p className="text-xs text-[var(--text2)]">Xác nhận tài khoản quản trị CRM để xem dữ liệu Meta.</p>
              <label className="block text-xs">Email
                <input autoComplete="username" type="email" required value={loginEmail} disabled={loginBusy} onChange={(event) => setLoginEmail(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--bg2)] p-2" />
              </label>
              <label className="block text-xs">Mật khẩu
                <input autoComplete="current-password" type="password" required value={loginPassword} disabled={loginBusy} onChange={(event) => setLoginPassword(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--bg2)] p-2" />
              </label>
              <button disabled={loginBusy} type="submit" className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
                {loginBusy && <Loader2 size={14} className="animate-spin" />}Xác nhận tài khoản
              </button>
              {loginError && <p role="alert" className="text-xs font-bold text-red-500">{loginError}</p>}
            </form>
          )}

          <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-lg bg-[var(--bg3)] p-4 text-sm">
            <span>Chi tiêu: <strong>{formatFullVnd(totalSpend)} VND</strong></span>
            <span>Trò chuyện: <strong>{totalConversations.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}</strong></span>
            <span>Đã tải: <strong>{accountIds.length} tài khoản</strong></span>
          </div>

          {error && <p role="alert" className="text-xs font-bold text-red-500">{error}</p>}
          {syncMessage && <p role="status" className="text-xs font-bold text-emerald-600">{syncMessage}</p>}
          {skippedCurrencies.length > 0 && (
            <p className="text-xs font-bold text-amber-600">
              Bỏ qua tài khoản dùng tiền tệ {skippedCurrencies.join(', ')}; bảng này chỉ hiển thị số tiền VND.
            </p>
          )}

          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full min-w-[1000px] text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg3)] text-[10px] font-extrabold uppercase tracking-wide text-[var(--text3)]">
                  <th className="whitespace-nowrap p-3">Tài khoản</th>
                  <th className="whitespace-nowrap p-3">Ngày</th>
                  <th className="whitespace-nowrap p-3">Mã NV</th>
                  <th className="min-w-[340px] p-3">Tên chiến dịch</th>
                  <th className="whitespace-nowrap p-3 text-right">Chi tiêu (VND)</th>
                  <th className="whitespace-nowrap p-3 text-right">Trò chuyện</th>
                </tr>
              </thead>
              <tbody>
                {loading && rows.length === 0 ? (
                  <tr><td colSpan={6} className="p-10 text-center text-[var(--text3)]"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Đang tải trực tiếp từ Meta Ads…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={6} className="p-10 text-center text-[var(--text3)]">{error ? 'Không tải được dữ liệu Meta Ads.' : 'Không có dữ liệu Meta Ads trong khoảng ngày này.'}</td></tr>
                ) : pageRows.map((row, index) => (
                  <tr key={`${row.accountId}-${row.date}-${row.campaignName}-${index}`} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg3)]">
                    <td className="whitespace-nowrap p-3">{row.accountId}</td>
                    <td className="whitespace-nowrap p-3">{formatReportDateVi(row.date)}</td>
                    <td className="whitespace-nowrap p-3">{row.employeeCode || '—'}</td>
                    <td className="max-w-[480px] truncate p-3" title={row.campaignName}>{row.campaignName}</td>
                    <td className="whitespace-nowrap p-3 text-right">{formatFullVnd(row.spendVnd)}</td>
                    <td className="whitespace-nowrap p-3 text-right">{Number(row.conversations || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!loading && rows.length > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-3 text-xs text-[var(--text3)]">
              <span>Hiển thị {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, rows.length)} / {rows.length} dòng</span>
              <div className="flex items-center gap-3">
                <button type="button" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="disabled:opacity-40">Trước</button>
                <span>{safePage}/{totalPages}</span>
                <button type="button" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="disabled:opacity-40">Sau</button>
              </div>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
};
