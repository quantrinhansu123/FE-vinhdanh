import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../../api/supabase';
import type { CrmTeamRow, TkqcAdListRow } from '../../../types';
import { AdAccountFormModal } from './AdAccountFormModal';

const TKQC_TABLE = import.meta.env.VITE_SUPABASE_TKQC_TABLE?.trim() || 'tkqc';
const TEAMS_TABLE = import.meta.env.VITE_SUPABASE_TEAMS_TABLE?.trim() || 'crm_teams';

const TKQC_SELECT = `
  id,
  id_du_an,
  ma_tkqc,
  ten_tkqc,
  ten_quang_cao,
  ten_pae,
  nen_tang,
  ngan_sach_phan_bo,
  chi_phi_thuc_te,
  id_marketing_staff,
  ngay_bat_dau,
  id_crm_team,
  trang_thai_tkqc,
  agency,
  du_an ( id, ma_du_an, ten_du_an, don_vi, ngay_bat_dau, trang_thai ),
  marketing_staff ( id_ns, name )
`;

const PAGE_SIZE = 10;

function formatCompactVnd(n: number | null | undefined): string {
  if (n == null || n === 0) return '0';
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  const abs = Math.abs(x);
  if (abs >= 1_000_000_000) {
    const v = x / 1_000_000_000;
    return `${v >= 10 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, '')}B`;
  }
  if (abs >= 1_000_000) {
    const v = x / 1_000_000;
    return `${v >= 10 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (abs >= 1_000) return `${Math.round(x / 1_000)}K`;
  return `${Math.round(x)}`;
}

function effectiveTkqcTrangThai(row: TkqcAdListRow): 'active' | 'thieu_thiet_lap' {
  return row.trang_thai_tkqc === 'thieu_thiet_lap' ? 'thieu_thiet_lap' : 'active';
}

function teamProjectLabel(row: TkqcAdListRow, teams: CrmTeamRow[]): string {
  const duAn = row.du_an;
  const proj = duAn
    ? [duAn.ma_du_an, duAn.ten_du_an].filter(Boolean).join(' · ') || duAn.ten_du_an
    : '—';

  if (row.id_crm_team) {
    const t = teams.find((x) => x.id === row.id_crm_team);
    const label = t?.ten_team || t?.ma_team;
    if (label) return proj === '—' ? label : `${label} · ${proj}`;
  }

  if (!duAn) return proj === '—' ? '—' : proj;
  const teamNames: string[] = [];
  for (const t of teams) {
    const ids = t.du_an_ids;
    if (!Array.isArray(ids)) continue;
    if (ids.some((x) => String(x) === duAn.id)) {
      const label = t.ten_team || t?.ma_team;
      if (label) teamNames.push(label);
    }
  }
  if (teamNames.length) return `${teamNames.join(' · ')} · ${proj}`;
  return proj;
}

function projectChips(row: TkqcAdListRow, teams: CrmTeamRow[]): string[] {
  const raw = teamProjectLabel(row, teams);
  if (raw === '—') return [];
  const parts = raw.split(' · ').map((s) => s.trim()).filter(Boolean);
  return parts.slice(0, 4);
}

function serviceLabel(row: TkqcAdListRow): string {
  const plat = row.nen_tang?.trim() || '—';
  const unit = row.agency?.trim() || row.du_an?.don_vi?.trim();
  if (unit) return `${plat} · ${unit}`;
  return plat;
}

function telegramDisplay(row: TkqcAdListRow): { text: string; href: string | null } {
  const p = row.ten_pae?.trim();
  if (p && (p.startsWith('@') || p.includes('t.me'))) {
    const href = p.startsWith('http') ? p : p.startsWith('@') ? `https://t.me/${p.slice(1)}` : '#';
    return { text: p.startsWith('@') ? p : p, href };
  }
  return { text: '—', href: null };
}

export const AdAccountsView: React.FC = () => {
  const [rows, setRows] = useState<TkqcAdListRow[]>([]);
  const [teams, setTeams] = useState<CrmTeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TkqcAdListRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const prev = document.title;
    document.title = 'Agency Control Center | Curator CRM';
    return () => {
      document.title = prev;
    };
  }, []);

  const loadTeams = useCallback(async () => {
    const { data, error: qErr } = await supabase
      .from(TEAMS_TABLE)
      .select('id, ma_team, ten_team, du_an_ids')
      .order('ten_team', { ascending: true });
    if (qErr) {
      console.error('crm_teams for ad accounts:', qErr);
      setTeams([]);
    } else {
      setTeams((data || []) as CrmTeamRow[]);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase
      .from(TKQC_TABLE)
      .select(TKQC_SELECT)
      .order('ma_tkqc', { ascending: true });

    if (qErr) {
      console.error('Supabase tkqc:', qErr);
      setError(qErr.message || 'Không tải được danh sách tài khoản Ads.');
      setRows([]);
    } else {
      setRows((data || []) as TkqcAdListRow[]);
    }
    await loadTeams();
    setLoading(false);
  }, [loadTeams]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = useCallback(
    async (row: TkqcAdListRow) => {
      const label = [row.ma_tkqc, row.ten_tkqc].filter(Boolean).join(' · ') || row.id;
      if (!window.confirm(`Xoá tài khoản Ads «${label}»? Không hoàn tác.`)) return;
      setDeletingId(row.id);
      setError(null);
      const closeForm = editing?.id === row.id;
      try {
        const { error: delErr } = await supabase.from(TKQC_TABLE).delete().eq('id', row.id);
        if (delErr) throw delErr;
        if (closeForm) {
          setEditing(null);
          setFormOpen(false);
        }
        await load();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Không xoá được.';
        setError(msg);
      } finally {
        setDeletingId(null);
      }
    },
    [load, editing?.id]
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const blob = [
        row.ma_tkqc,
        row.ten_tkqc,
        row.ten_quang_cao,
        row.agency,
        row.nen_tang,
        row.marketing_staff?.name,
        row.du_an?.ten_du_an,
        row.du_an?.ma_du_an,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [rows, search]);

  useEffect(() => {
    setPage(1);
  }, [search, rows.length]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, safePage]);

  const metrics = useMemo(() => {
    const active = rows.filter((r) => effectiveTkqcTrangThai(r) === 'active').length;
    const debtSum = rows.reduce((s, r) => s + (Number(r.chi_phi_thuc_te) || 0), 0);
    const budgetSum = rows.reduce((s, r) => s + (Number(r.ngan_sach_phan_bo) || 0), 0);
    return { active, total: rows.length, debtSum, budgetSum };
  }, [rows]);

  const debtLabel =
    metrics.debtSum >= 1_000_000
      ? `${formatCompactVnd(metrics.debtSum)} VND`
      : metrics.debtSum > 0
        ? formatCompactVnd(metrics.debtSum)
        : '0';

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <div
      className="acc-cc -m-3 min-h-[calc(100vh-5.5rem)] bg-[#181c22] p-6 text-[#dfe2eb] antialiased selection:bg-[#00e5ff]/30 sm:p-8 font-[Inter,sans-serif] acc-cc-scroll overflow-x-hidden"
    >
      <div className="mb-8 flex flex-col justify-end gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-[Manrope,sans-serif] text-2xl font-extrabold tracking-tight text-cyan-50 sm:text-3xl">
            Agency Control Center
          </h2>
          <p className="mt-1 text-sm text-[#bac9cc]">Real-time oversight of partner operations and liquidity.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-500">
              search
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter accounts…"
              className="w-full min-w-[200px] rounded-full border-0 bg-[#0a0e14]/50 py-1.5 pl-10 pr-4 text-sm text-[#dfe2eb] ring-1 ring-white/5 transition-all placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-400/50 sm:w-64"
            />
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-lg bg-[#1c2026] p-2 text-slate-400 transition-colors hover:bg-[#31353c] disabled:opacity-50"
            title="Làm mới"
          >
            <span
              className={`material-symbols-outlined text-xl ${loading ? 'animate-spin' : ''}`}
            >
              {loading ? 'progress_activity' : 'refresh'}
            </span>
          </button>
          <button
            type="button"
            className="rounded-lg bg-[#1c2026] p-2 text-slate-400 transition-colors hover:bg-[#31353c]"
            title="Export (sắp có)"
            disabled
          >
            <span className="material-symbols-outlined text-xl">download</span>
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="rounded-lg bg-gradient-to-r from-cyan-400 to-cyan-600 px-4 py-2 text-sm font-bold text-[#00363d] shadow-lg shadow-cyan-900/20 transition-transform active:scale-95"
          >
            Add account
          </button>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="acc-cc-glass acc-cc-glow-cyan rounded-2xl border border-white/5 p-6">
          <div className="mb-4 flex items-start justify-between">
            <div className="rounded-lg bg-cyan-400/10 p-2">
              <span className="material-symbols-outlined text-cyan-400">hub</span>
            </div>
            <span className="rounded bg-emerald-400/10 px-2 py-0.5 text-xs font-bold text-emerald-400">
              {metrics.total ? `${Math.round((metrics.active / metrics.total) * 100)}%` : '—'}
            </span>
          </div>
          <p className="text-sm font-medium text-[#bac9cc]">Total active accounts</p>
          <h3 className="mt-1 font-[Manrope,sans-serif] text-3xl font-bold text-cyan-50">{metrics.active}</h3>
        </div>
        <div className="acc-cc-glass rounded-2xl border border-white/5 p-6">
          <div className="mb-4 flex items-start justify-between">
            <div className="rounded-lg bg-[#ffb4ab]/10 p-2">
              <span className="material-symbols-outlined text-[#ffb4ab]">account_balance_wallet</span>
            </div>
            <span
              className={`rounded px-2 py-0.5 text-xs font-bold ${
                metrics.debtSum > 0 ? 'bg-[#ffb4ab]/10 text-[#ffb4ab]' : 'bg-emerald-400/10 text-emerald-400'
              }`}
            >
              {metrics.debtSum > 0 ? 'Spend tracked' : 'Clear'}
            </span>
          </div>
          <p className="text-sm font-medium text-[#bac9cc]">Total actual spend</p>
          <h3 className="mt-1 font-[Manrope,sans-serif] text-3xl font-bold text-cyan-50">{debtLabel}</h3>
        </div>
        <div className="acc-cc-glass rounded-2xl border border-white/5 p-6">
          <div className="mb-4 flex items-start justify-between">
            <div className="rounded-lg bg-[#00e5ff]/10 p-2">
              <span className="material-symbols-outlined text-[#00e5ff]">trending_up</span>
            </div>
            <span className="rounded bg-cyan-400/10 px-2 py-0.5 text-xs font-bold text-cyan-400">Allocated</span>
          </div>
          <p className="text-sm font-medium text-[#bac9cc]">Total allocated budget</p>
          <h3 className="mt-1 font-[Manrope,sans-serif] text-3xl font-bold text-cyan-50">
            {formatCompactVnd(metrics.budgetSum)}{' '}
            <span className="text-sm font-normal text-slate-500">VND</span>
          </h3>
        </div>
      </div>

      <div className="acc-cc-glass overflow-hidden rounded-2xl border border-white/5">
        <div className="flex flex-col gap-3 border-b border-white/5 bg-slate-900/40 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <h4 className="font-[Manrope,sans-serif] font-bold text-cyan-100">Agency master ledger</h4>
          <div className="flex flex-wrap gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> Active
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400" /> Monitoring
            </div>
          </div>
        </div>

        {error && (
          <div className="border-b border-white/5 bg-red-950/30 px-6 py-3 text-xs text-red-300">{error}</div>
        )}

        {loading && !rows.length ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Đang tải tài khoản Ads…
          </div>
        ) : (
          <div className="overflow-x-auto acc-cc-scroll">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#31353c]/30">
                  <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 sm:px-6">
                    ID
                  </th>
                  <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 sm:px-6">
                    Account
                  </th>
                  <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 sm:px-6">
                    Contact
                  </th>
                  <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 sm:px-6">
                    Link / PAE
                  </th>
                  <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 sm:px-6">
                    Service
                  </th>
                  <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 sm:px-6">
                    Projects
                  </th>
                  <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 sm:px-6">
                    Budget
                  </th>
                  <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 sm:px-6">
                    Spend
                  </th>
                  <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 sm:px-6">
                    Status
                  </th>
                  <th className="px-4 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-slate-500 sm:px-6">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredRows.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-16 text-center text-sm text-slate-500">
                      <p className="mb-4">
                        Chưa có bản ghi hoặc không khớp bộ lọc. Thêm trong bảng{' '}
                        <code className="text-cyan-400/80">{TKQC_TABLE}</code> hoặc nút Add account.
                      </p>
                      <button
                        type="button"
                        onClick={openAdd}
                        className="rounded-lg bg-gradient-to-r from-cyan-400 to-cyan-600 px-5 py-2 text-sm font-bold text-[#00363d]"
                      >
                        Add account
                      </button>
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row) => {
                    const warn = effectiveTkqcTrangThai(row) === 'thieu_thiet_lap';
                    const mkt = row.marketing_staff;
                    const tg = telegramDisplay(row);
                    const chips = projectChips(row, teams);
                    const spend = row.chi_phi_thuc_te;

                    return (
                      <tr key={row.id} className="group transition-colors hover:bg-white/[0.02]">
                        <td className="px-4 py-5 font-mono text-sm text-cyan-400 sm:px-6">{row.ma_tkqc}</td>
                        <td className="px-4 py-5 text-sm font-bold text-cyan-50 sm:px-6">
                          {row.ten_tkqc?.trim() || '—'}
                        </td>
                        <td className="px-4 py-5 text-sm text-[#bac9cc] sm:px-6">{mkt?.name || '—'}</td>
                        <td className="px-4 py-5 sm:px-6">
                          {tg.href ? (
                            <a
                              href={tg.href}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 text-sm text-cyan-400/80 underline decoration-cyan-400/20 underline-offset-4 hover:text-cyan-400"
                            >
                              {tg.text}
                            </a>
                          ) : (
                            <span className="text-sm text-[#bac9cc]" title={row.ten_pae || ''}>
                              {row.ten_pae?.trim() || '—'}
                            </span>
                          )}
                        </td>
                        <td className="max-w-[140px] truncate px-4 py-5 text-sm text-[#bac9cc] sm:px-6" title={serviceLabel(row)}>
                          {serviceLabel(row)}
                        </td>
                        <td className="px-4 py-5 sm:px-6">
                          <div className="flex flex-wrap gap-1">
                            {chips.length ? (
                              chips.map((c) => (
                                <span
                                  key={c}
                                  className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300"
                                >
                                  {c}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-slate-600">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-5 text-sm font-semibold text-cyan-100 sm:px-6 tabular-nums">
                          {formatCompactVnd(row.ngan_sach_phan_bo)}
                        </td>
                        <td className="px-4 py-5 text-sm font-semibold tabular-nums sm:px-6">
                          {spend != null && spend > 0 ? (
                            <span className="text-amber-400">{formatCompactVnd(spend)}</span>
                          ) : (
                            <span className="text-slate-500">0</span>
                          )}
                        </td>
                        <td className="px-4 py-5 sm:px-6">
                          {warn ? (
                            <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400">
                              Monitoring
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-5 text-right sm:px-6">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditing(row);
                                setFormOpen(true);
                              }}
                              disabled={deletingId === row.id}
                              className="rounded bg-white/5 p-1.5 text-slate-400 transition-all hover:bg-cyan-400/10 hover:text-cyan-400 disabled:opacity-40"
                              title="Sửa"
                            >
                              <span className="material-symbols-outlined text-lg">edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(row)}
                              disabled={deletingId !== null || loading}
                              className="rounded bg-white/5 p-1.5 text-slate-400 transition-all hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                              title="Xoá"
                            >
                              {deletingId === row.id ? (
                                <Loader2 className="h-[22px] w-[22px] animate-spin" />
                              ) : (
                                <span className="material-symbols-outlined text-lg">delete</span>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {filteredRows.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-white/5 bg-slate-900/40 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-xs text-slate-500">
              Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredRows.length)} of{' '}
              {filteredRows.length} accounts
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded px-3 py-1 text-xs font-bold text-slate-400 transition-colors hover:text-cyan-300 disabled:opacity-30"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((n) => n === 1 || n === totalPages || Math.abs(n - safePage) <= 1)
                .map((n, idx, arr) => (
                  <React.Fragment key={n}>
                    {idx > 0 && arr[idx - 1] !== n - 1 && <span className="text-slate-600">…</span>}
                    <button
                      type="button"
                      onClick={() => setPage(n)}
                      className={`rounded px-3 py-1 text-xs font-bold ${
                        n === safePage ? 'bg-cyan-400/10 text-cyan-400' : 'text-slate-400 hover:text-cyan-300'
                      }`}
                    >
                      {n}
                    </button>
                  </React.Fragment>
                ))}
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded px-3 py-1 text-xs font-bold text-slate-400 transition-colors hover:text-cyan-300 disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={openAdd}
        className="fixed bottom-8 right-8 flex h-14 w-14 items-center justify-center rounded-full bg-[#00e5ff] text-[#00363d] shadow-2xl shadow-cyan-500/40 transition-transform active:scale-90 md:hidden"
        aria-label="Add account"
      >
        <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
          add
        </span>
      </button>

      <AdAccountFormModal
        open={formOpen}
        initial={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSaved={() => void load()}
      />
    </div>
  );
};
