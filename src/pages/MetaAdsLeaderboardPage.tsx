import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { BarChart3, CalendarDays, Loader2, LogOut, RefreshCw, Trophy } from 'lucide-react';
import { supabase } from '../api/supabase';
import backgroundImg from '../assets/background.png';
import top1Img from '../assets/top1.png';
import top2Img from '../assets/top2.png';
import top3Img from '../assets/top3.png';

type MetaAccount = {
  account_id: string;
  account_name: string | null;
  currency: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  purchase_value: number;
  purchase_count: number;
  last_synced_at: string | null;
};

type MetaLeaderboardResponse = {
  accounts: MetaAccount[];
  currencies: string[];
  lastSyncedAt: string | null;
  dateFrom: string;
  dateTo: string;
};

function dateInReportingTimezone(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function initialRange() {
  const today = dateInReportingTimezone();
  const from = new Date(`${today}T12:00:00.000Z`);
  from.setUTCDate(from.getUTCDate() - 6);
  return { from: from.toISOString().slice(0, 10), to: today };
}

function formatMoney(value: number, currency: string | null) {
  if (!currency) return `${Math.round(value).toLocaleString('vi-VN')}`;
  try {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency', currency, maximumFractionDigits: currency === 'VND' ? 0 : 2,
    }).format(value);
  } catch {
    return `${value.toLocaleString('vi-VN')} ${currency}`;
  }
}

function formatSyncTime(value: string | null) {
  if (!value) return 'Chưa có lần đồng bộ';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Thời gian đồng bộ không hợp lệ';
  return `Đồng bộ lúc ${new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'medium',
  }).format(date)} (GMT+7)`;
}

export function MetaAdsLeaderboardPage({ onLogout }: { onLogout: () => void | Promise<void> }) {
  const range = useMemo(initialRange, []);
  const [dateFrom, setDateFrom] = useState(range.from);
  const [dateTo, setDateTo] = useState(range.to);
  const [data, setData] = useState<MetaLeaderboardResponse | null>(null);
  const [currency, setCurrency] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) throw new Error('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.');
      const query = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
      const response = await fetch(`/api/meta-ads-leaderboard?${query.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      });
      const payload = await response.json() as MetaLeaderboardResponse & { message?: string };
      if (!response.ok) throw new Error(payload.message || 'Không tải được dữ liệu Meta.');
      setData(payload);
      setCurrency((current) => payload.currencies.includes(current) ? current : payload.currencies[0] || '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được dữ liệu Meta.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [load]);

  const accounts = useMemo(() => (data?.accounts || [])
    .filter((account) => !currency || account.currency === currency)
    .sort((a, b) => (b.purchase_value - a.purchase_value) || (b.spend - a.spend))
    .map((account, index) => ({ ...account, rank: index + 1 })), [data, currency]);
  const purchaseValueAvailable = accounts.some((account) => account.purchase_value > 0);
  const rankedAccounts = useMemo(() => {
    const ranked = [...accounts];
    if (!purchaseValueAvailable) ranked.sort((a, b) => b.spend - a.spend);
    return ranked.map((account, index) => ({ ...account, rank: index + 1 }));
  }, [accounts, purchaseValueAvailable]);
  const podium = [rankedAccounts[2], rankedAccounts[0], rankedAccounts[1]].filter(Boolean);
  const others = rankedAccounts.slice(3);
  const lastSyncedAt = rankedAccounts.reduce<string | null>((latest, account) => (
    account.last_synced_at && (!latest || account.last_synced_at > latest) ? account.last_synced_at : latest
  ), null) || data?.lastSyncedAt || null;
  const rankMetricLabel = purchaseValueAvailable ? 'Giá trị mua hàng Meta' : 'Chi tiêu quảng cáo';

  return (
    <main className="min-h-screen w-full overflow-hidden relative flex flex-col text-white font-sans antialiased">
      <div className="absolute inset-0 -z-10" style={{ backgroundImage: `url(${backgroundImg})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-emerald-950/65 via-emerald-950/10 to-black/35" />

      <nav className="relative z-20 flex flex-wrap items-center justify-between gap-3 px-4 py-4 lg:px-8">
        <div className="flex flex-wrap gap-2">
          <Link to="/" className="rounded-xl border border-white/15 bg-black/35 px-4 py-2 text-xs font-bold text-white/75 hover:bg-black/55">Nhân viên · Odoo</Link>
          <span className="rounded-xl border border-amber-300/60 bg-amber-400/20 px-4 py-2 text-xs font-bold text-amber-100">Tài khoản Ads · Meta</span>
          <Link to="/crm-admin/admin-dash" className="rounded-xl border border-white/15 bg-black/35 px-4 py-2 text-xs font-bold text-white/75 hover:bg-black/55">CRM Admin</Link>
        </div>
        <button type="button" onClick={() => void onLogout()} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-black/35 px-4 py-2 text-xs font-bold hover:bg-black/55">
          <LogOut size={14} /> Đăng xuất
        </button>
      </nav>

      <header className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center gap-4 px-4 pb-4 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-amber-100/80">Meta Ads · Account level</p>
        <h1 className="text-4xl font-black uppercase tracking-wide text-amber-300 drop-shadow-[0_3px_8px_rgba(0,0,0,.8)] sm:text-6xl">VINH DANH ADS</h1>
        <p className="text-sm font-semibold text-white/80">Xếp hạng tài khoản quảng cáo theo dữ liệu Meta đã đồng bộ</p>
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/15 bg-black/35 p-3 backdrop-blur-md">
          <label className="flex items-center gap-2 text-xs text-white/70"><CalendarDays size={14} /> Từ <input type="date" value={dateFrom} max={dateTo} onChange={(event) => setDateFrom(event.target.value)} className="rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-white [color-scheme:dark]" /></label>
          <label className="flex items-center gap-2 text-xs text-white/70">Đến <input type="date" value={dateTo} min={dateFrom} max={dateInReportingTimezone()} onChange={(event) => setDateTo(event.target.value)} className="rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-white [color-scheme:dark]" /></label>
          {data?.currencies.length ? (
            <label className="flex items-center gap-2 text-xs text-white/70">Tiền tệ
              <select value={currency} onChange={(event) => setCurrency(event.target.value)} className="rounded-lg border border-white/15 bg-emerald-950 px-3 py-1.5 text-white">
                {data.currencies.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          ) : null}
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-3 py-2 text-xs font-black text-emerald-950 disabled:opacity-50">
            {refreshing || loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Làm mới
          </button>
        </div>
        <p className="text-[11px] text-white/65">{dateFrom} → {dateTo} · {formatSyncTime(lastSyncedAt)} · Xếp theo {rankMetricLabel}</p>
      </header>

      {error ? <div role="alert" className="relative z-20 mx-auto mt-2 max-w-2xl rounded-xl border border-red-300/35 bg-red-950/70 px-5 py-3 text-sm text-red-100">{error}</div> : null}

      <section className="relative z-10 mx-auto grid w-full max-w-[1500px] flex-1 grid-cols-1 gap-5 px-4 pb-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8">
        <div className="flex min-h-[570px] flex-col items-center justify-center rounded-3xl border border-white/10 bg-emerald-950/15 py-8 backdrop-blur-[2px]">
          {loading && !data ? (
            <div className="flex flex-col items-center gap-3 text-amber-100"><Loader2 size={42} className="animate-spin" /><span className="font-bold">Đang tải dữ liệu Meta…</span></div>
          ) : rankedAccounts.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-black/30 p-8 text-center text-white/75">
              <BarChart3 size={34} className="text-amber-300" />
              <strong>Chưa có dữ liệu trong khoảng ngày này</strong>
              <span className="max-w-md text-sm">Kiểm tra API đồng bộ, quyền đọc Meta và bảng facebook_ad_account_daily trong Supabase.</span>
            </div>
          ) : (
            <>
              <div className="mb-10 flex w-full max-w-4xl items-end justify-center gap-2 sm:gap-8">
                {podium.map((account) => (
                  <MetaWinnerCard key={account.account_id} account={account} isCenter={account.rank === 1} metric={purchaseValueAvailable ? account.purchase_value : account.spend} currency={currency} />
                ))}
              </div>
              <div className="grid w-full max-w-3xl grid-cols-2 gap-2 px-3 text-center sm:grid-cols-4">
                <Metric label="Tài khoản" value={String(rankedAccounts.length)} />
                <Metric label="Chi tiêu" value={formatMoney(rankedAccounts.reduce((sum, item) => sum + item.spend, 0), currency)} />
                <Metric label="Lượt hiển thị" value={rankedAccounts.reduce((sum, item) => sum + item.impressions, 0).toLocaleString('vi-VN')} />
                <Metric label="Lượt nhấp" value={rankedAccounts.reduce((sum, item) => sum + item.clicks, 0).toLocaleString('vi-VN')} />
              </div>
            </>
          )}
        </div>

        <aside className="flex max-h-[calc(100vh-170px)] min-h-[400px] flex-col overflow-hidden rounded-3xl border border-white/15 bg-black/55 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-4">
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider"><Trophy size={17} className="text-amber-300" /> Bảng xếp hạng</h2>
            <span className="text-[10px] text-white/45">TOP 1 - {rankedAccounts.length}</span>
          </div>
          <div className="grid grid-cols-12 gap-2 bg-black/25 px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-amber-200/80">
            <span className="col-span-1">#</span><span className="col-span-6">Tài khoản</span><span className="col-span-5 text-right">{purchaseValueAvailable ? 'Giá trị mua' : 'Chi tiêu'}</span>
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto p-2">
            {rankedAccounts.map((account) => (
              <div key={account.account_id} className={`grid grid-cols-12 items-center gap-2 rounded-xl border px-2 py-2.5 ${account.rank <= 3 ? 'border-amber-300/25 bg-amber-400/10' : 'border-white/5 bg-white/[0.04]'}`}>
                <span className="col-span-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/35 text-[10px] font-black text-amber-100">{account.rank}</span>
                <span className="col-span-6 min-w-0"><strong className="block truncate text-xs" title={account.account_name || account.account_id}>{account.account_name || 'Ad account'}</strong><small className="block truncate text-[9px] text-white/45">{account.account_id}</small></span>
                <span className="col-span-5 text-right text-[10px] font-bold text-amber-200">{formatMoney(purchaseValueAvailable ? account.purchase_value : account.spend, currency)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-white/10 px-4 py-3 text-[10px] leading-5 text-white/50">
            Meta Ads không ghép nhân viên. Bảng này xếp hạng theo tài khoản quảng cáo; doanh thu mua hàng là số Meta attribution trả về.
          </div>
        </aside>
      </section>
    </main>
  );
}

function MetaWinnerCard({ account, isCenter, metric, currency }: { account: MetaAccount & { rank: number }; isCenter: boolean; metric: number; currency: string }) {
  const frame = account.rank === 1 ? top1Img : account.rank === 2 ? top2Img : top3Img;
  return (
    <motion.article initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: account.rank * 0.08 }} className={`flex min-w-0 flex-1 flex-col items-center text-center ${isCenter ? 'max-w-[230px] -translate-y-7' : 'max-w-[175px] translate-y-5'}`}>
      <div className={`relative flex items-center justify-center ${isCenter ? 'h-48 w-48 sm:h-60 sm:w-60' : 'h-36 w-36 sm:h-44 sm:w-44'}`}>
        <div className="absolute inset-[13%] rounded-full border-[5px] border-amber-300 bg-gradient-to-br from-emerald-900 to-black shadow-[0_0_40px_rgba(250,204,21,.35)]" />
        <div className="absolute inset-[21%] z-10 flex flex-col items-center justify-center rounded-full border border-amber-100/30 bg-black/55 px-3 shadow-inner">
          <span className="mb-1 text-[9px] font-black uppercase tracking-[.22em] text-amber-200">#{account.rank} · {account.currency || currency}</span>
          <strong className="line-clamp-2 w-full text-xs font-black uppercase text-white sm:text-sm" title={account.account_name || account.account_id}>{account.account_name || 'Ad account'}</strong>
          <span className="mt-2 text-[10px] font-bold text-amber-200">{formatMoney(metric, currency)}</span>
        </div>
        <img src={frame} alt={`Hạng ${account.rank}`} className="pointer-events-none absolute inset-0 z-20 h-full w-full object-contain drop-shadow-2xl" />
      </div>
      <p className="-mt-1 max-w-full truncate rounded-full border border-amber-200/40 bg-amber-400/90 px-3 py-1 text-[10px] font-black text-emerald-950 sm:text-xs" title={account.account_id}>{account.account_id}</p>
      <span className="mt-1 text-[9px] text-white/65">{account.purchase_count.toLocaleString('vi-VN')} đơn · {account.clicks.toLocaleString('vi-VN')} click</span>
    </motion.article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-black/30 px-2 py-3"><p className="text-[9px] font-bold uppercase tracking-wider text-white/55">{label}</p><p className="mt-1 truncate text-xs font-black text-amber-200 sm:text-sm" title={value}>{value}</p></div>;
}
