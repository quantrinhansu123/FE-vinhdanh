/**
 * Tổng quan ngân sách — bảng yêu cầu xin ngân sách (Supabase budget_requests + tkqc_accounts)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Eye, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatVnd } from './dashboardAdminUtils';
import type { TkqcAccountRow } from './AdsTkqcAccountsTable';

const TABLE = import.meta.env.VITE_SUPABASE_BUDGET_REQUESTS_TABLE?.trim() || 'budget_requests';
const TKQC_TABLE = import.meta.env.VITE_SUPABASE_TKQC_ACCOUNTS_TABLE?.trim() || 'tkqc_accounts';

export type BudgetRequestStatus = 'cho_phe_duyet' | 'dong_y' | 'tu_choi';

export type BudgetRequestRow = {
  id: string;
  ngan_sach_xin: number;
  ngay_gio_xin: string;
  trang_thai: BudgetRequestStatus;
  ly_do_tu_choi: string | null;
  ghi_chu: string | null;
  tkqc_account_id: string | null;
  tkqc_accounts?: {
    id: string;
    don_vi: string | null;
    tkqc: string;
    page: string | null;
  } | null;
};

const STATUS_LABEL: Record<BudgetRequestStatus, string> = {
  cho_phe_duyet: 'Chờ phê duyệt',
  dong_y: 'Đồng ý',
  tu_choi: 'Từ chối',
};

const EMPTY_PROJECT = '__EMPTY__';

function projectKeyFromDonVi(donVi: string | null | undefined): string {
  const t = (donVi || '').trim();
  return t || EMPTY_PROJECT;
}

function labelProject(key: string): string {
  return key === EMPTY_PROJECT ? '(Chưa có đơn vị)' : key;
}

function statusBadgeClass(s: BudgetRequestStatus): string {
  if (s === 'cho_phe_duyet') return 'bg-crm-warning/15 text-crm-warning border-crm-warning/30';
  if (s === 'dong_y') return 'bg-crm-success/15 text-crm-success border-crm-success/30';
  return 'bg-crm-error/15 text-crm-error border-crm-error/30';
}

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(v: string): string {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/** Hiển thị tiền có dấu chấm phân cách (nhập chỉ số, lưu chuỗi số thuần) */
function formatDigitsDisplay(digitsRaw: string): string {
  const d = digitsRaw.replace(/\D/g, '');
  if (!d) return '';
  return Number(d).toLocaleString('vi-VN', { maximumFractionDigits: 0 });
}

function parseDigitsToInt(digitsRaw: string): number {
  return parseInt(digitsRaw.replace(/\D/g, ''), 10) || 0;
}

export function BudgetSummaryTable() {
  const [rows, setRows] = useState<BudgetRequestRow[]>([]);
  const [tkqcAccounts, setTkqcAccounts] = useState<TkqcAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [viewRow, setViewRow] = useState<BudgetRequestRow | null>(null);
  const [editRow, setEditRow] = useState<BudgetRequestRow | null>(null);
  const [editAmountDigits, setEditAmountDigits] = useState('');
  const [editDatetime, setEditDatetime] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editProjectKey, setEditProjectKey] = useState('');
  const [editTkqcId, setEditTkqcId] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createAmountDigits, setCreateAmountDigits] = useState('');
  const [createDatetime, setCreateDatetime] = useState(() => toDatetimeLocalValue(new Date().toISOString()));
  const [createNote, setCreateNote] = useState('');
  const [createProjectKey, setCreateProjectKey] = useState('');
  const [createTkqcId, setCreateTkqcId] = useState('');

  const [rejectRow, setRejectRow] = useState<BudgetRequestRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [saving, setSaving] = useState(false);

  const projectKeys = useMemo(() => {
    const set = new Set<string>();
    tkqcAccounts.forEach((a) => set.add(projectKeyFromDonVi(a.don_vi)));
    return Array.from(set).sort((a, b) => {
      if (a === EMPTY_PROJECT) return 1;
      if (b === EMPTY_PROJECT) return -1;
      return a.localeCompare(b, 'vi');
    });
  }, [tkqcAccounts]);

  const accountsForCreate = useMemo(
    () => tkqcAccounts.filter((a) => projectKeyFromDonVi(a.don_vi) === createProjectKey),
    [tkqcAccounts, createProjectKey]
  );

  const accountsForEdit = useMemo(
    () => tkqcAccounts.filter((a) => projectKeyFromDonVi(a.don_vi) === editProjectKey),
    [tkqcAccounts, editProjectKey]
  );

  const fetchTkqcAccounts = useCallback(async () => {
    const { data, error: err } = await supabase
      .from(TKQC_TABLE)
      .select('id, don_vi, tkqc, page')
      .order('don_vi', { ascending: true })
      .order('tkqc', { ascending: true });
    if (err) {
      console.error(err);
      setTkqcAccounts([]);
      return;
    }
    setTkqcAccounts((data || []) as TkqcAccountRow[]);
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: raw, error: err } = await supabase
      .from(TABLE)
      .select('*')
      .order('ngay_gio_xin', { ascending: false });
    if (err) {
      console.error(err);
      setError(err.message || 'Không tải được danh sách');
      setRows([]);
      setLoading(false);
      return;
    }
    const list = (raw || []) as BudgetRequestRow[];
    const ids = [...new Set(list.map((r) => r.tkqc_account_id).filter((id): id is string => Boolean(id)))];
    let accountMap = new Map<string, { id: string; don_vi: string | null; tkqc: string; page: string | null }>();
    if (ids.length > 0) {
      const { data: accs, error: accErr } = await supabase.from(TKQC_TABLE).select('id, don_vi, tkqc, page').in('id', ids);
      if (accErr) {
        console.error(accErr);
        setError(accErr.message || 'Không tải được tài khoản TKQC');
      } else {
        (accs || []).forEach((a) => {
          accountMap.set(a.id, a as { id: string; don_vi: string | null; tkqc: string; page: string | null });
        });
      }
    }
    const merged: BudgetRequestRow[] = list.map((r) => ({
      ...r,
      tkqc_accounts: r.tkqc_account_id ? accountMap.get(r.tkqc_account_id) ?? null : null,
    }));
    setRows(merged);
    setLoading(false);
  }, []);

  const loadAll = useCallback(async () => {
    await fetchTkqcAccounts();
    await fetchRows();
  }, [fetchTkqcAccounts, fetchRows]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpenId(null);
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const openEdit = (r: BudgetRequestRow) => {
    setEditRow(r);
    setEditAmountDigits(String(Math.round(Number(r.ngan_sach_xin) || 0)));
    setEditDatetime(toDatetimeLocalValue(r.ngay_gio_xin));
    setEditNote(r.ghi_chu || '');
    const acc = r.tkqc_accounts;
    const key = acc ? projectKeyFromDonVi(acc.don_vi) : projectKeys[0] || EMPTY_PROJECT;
    setEditProjectKey(key);
    setEditTkqcId(r.tkqc_account_id || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRow) return;
    const amount = parseDigitsToInt(editAmountDigits);
    if (amount <= 0) {
      alert('Số tiền xin phải lớn hơn 0');
      return;
    }
    if (!editTkqcId) {
      alert('Chọn dự án và tài khoản TKQC');
      return;
    }
    setSaving(true);
    const { error: err } = await supabase
      .from(TABLE)
      .update({
        ngan_sach_xin: amount,
        ngay_gio_xin: fromDatetimeLocalValue(editDatetime),
        ghi_chu: editNote.trim() || null,
        tkqc_account_id: editTkqcId,
      })
      .eq('id', editRow.id);
    setSaving(false);
    if (err) {
      alert(err.message || 'Không lưu được');
      return;
    }
    setEditRow(null);
    fetchRows();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseDigitsToInt(createAmountDigits);
    if (amount <= 0) {
      alert('Số tiền xin phải lớn hơn 0');
      return;
    }
    if (!createTkqcId) {
      alert('Chọn dự án và tài khoản TKQC');
      return;
    }
    setSaving(true);
    const { error: err } = await supabase.from(TABLE).insert({
      ngan_sach_xin: amount,
      ngay_gio_xin: fromDatetimeLocalValue(createDatetime),
      trang_thai: 'cho_phe_duyet',
      ghi_chu: createNote.trim() || null,
      tkqc_account_id: createTkqcId,
    });
    setSaving(false);
    if (err) {
      alert(err.message || 'Không tạo được yêu cầu');
      return;
    }
    setCreateOpen(false);
    setCreateAmountDigits('');
    setCreateNote('');
    setCreateDatetime(toDatetimeLocalValue(new Date().toISOString()));
    setCreateTkqcId('');
    fetchRows();
  };

  const handleDelete = async (r: BudgetRequestRow) => {
    if (!confirm('Xóa yêu cầu này?')) return;
    setSaving(true);
    const { error: err } = await supabase.from(TABLE).delete().eq('id', r.id);
    setSaving(false);
    if (err) {
      alert(err.message || 'Không xóa được');
      return;
    }
    fetchRows();
  };

  const handleApprove = async (id: string) => {
    setMenuOpenId(null);
    setSaving(true);
    const { error: err } = await supabase
      .from(TABLE)
      .update({ trang_thai: 'dong_y', ly_do_tu_choi: null })
      .eq('id', id);
    setSaving(false);
    if (err) {
      alert(err.message || 'Không cập nhật được');
      return;
    }
    fetchRows();
  };

  const openReject = (r: BudgetRequestRow) => {
    setMenuOpenId(null);
    setRejectRow(r);
    setRejectReason('');
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectRow) return;
    const reason = rejectReason.trim();
    if (!reason) {
      alert('Vui lòng nhập lý do từ chối');
      return;
    }
    setSaving(true);
    const { error: err } = await supabase
      .from(TABLE)
      .update({ trang_thai: 'tu_choi', ly_do_tu_choi: reason })
      .eq('id', rejectRow.id);
    setSaving(false);
    if (err) {
      alert(err.message || 'Không từ chối được');
      return;
    }
    setRejectRow(null);
    setRejectReason('');
    fetchRows();
  };

  const openCreateModal = () => {
    setCreateOpen(true);
    setCreateDatetime(toDatetimeLocalValue(new Date().toISOString()));
    const firstKey = projectKeys[0] ?? EMPTY_PROJECT;
    setCreateProjectKey(firstKey);
    const firstAcc = tkqcAccounts.find((a) => projectKeyFromDonVi(a.don_vi) === firstKey);
    setCreateTkqcId(firstAcc?.id || '');
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-0 sm:px-1">
      <div id="crm-budget-summary" className="crm-glass-card rounded-2xl overflow-hidden border border-crm-outline/30">
        <div className="px-5 sm:px-8 py-5 border-b border-crm-outline/30 bg-crm-surface-accent/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="text-center sm:text-left">
            <h2 className="text-xl font-bold text-crm-on-surface tracking-tight">Tổng quan ngân sách</h2>
            <p className="text-xs text-crm-on-surface-variant mt-1">Yêu cầu xin ngân sách — liên kết {TKQC_TABLE}</p>
          </div>
          <div className="flex flex-wrap justify-center sm:justify-end gap-2">
            <button
              type="button"
              onClick={openCreateModal}
              disabled={tkqcAccounts.length === 0}
              title={tkqcAccounts.length === 0 ? 'Cần có dòng trong tkqc_accounts' : undefined}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-crm-primary text-white text-xs font-bold uppercase tracking-wider shadow-[0_0_16px_rgba(34,197,94,0.25)] hover:bg-crm-primary/90 transition-colors disabled:opacity-40"
            >
              <Plus size={16} />
              Tạo yêu cầu
            </button>
            <button
              type="button"
              onClick={() => loadAll()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-crm-primary/15 hover:bg-crm-primary/25 text-crm-primary text-xs font-bold uppercase tracking-wider border border-crm-primary/30 transition-colors disabled:opacity-50"
            >
              <Loader2 className={loading ? 'animate-spin' : ''} size={16} />
              Làm mới
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-5 sm:mx-8 mt-4 px-4 py-3 rounded-xl border border-crm-error/50 bg-crm-error/10 text-sm text-crm-error">{error}</div>
        )}

        <div className="overflow-x-auto p-4 sm:p-6">
          {loading && rows.length === 0 ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-crm-primary w-10 h-10" />
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[1000px] table-fixed">
              <colgroup>
                <col className="w-[14%]" />
                <col className="w-[14%]" />
                <col className="w-[14%]" />
                <col className="w-[16%]" />
                <col className="w-[12%]" />
                <col className="w-[18%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead>
                <tr className="bg-crm-surface-accent/40 border-b border-crm-outline/40">
                  <th className="px-3 py-3 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider">Dự án</th>
                  <th className="px-3 py-3 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider">TKQC</th>
                  <th className="px-3 py-3 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider text-right">Xin ngân sách</th>
                  <th className="px-3 py-3 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider">Ngày giờ xin</th>
                  <th className="px-3 py-3 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider">Trạng thái</th>
                  <th className="px-3 py-3 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider">Ghi chú / Lý do</th>
                  <th className="px-3 py-3 text-[10px] font-extrabold text-crm-on-surface-variant uppercase tracking-wider text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-crm-outline/20">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-crm-on-surface-variant text-sm">
                      Chưa có yêu cầu. Chạy SQL (budget_requests + tkqc_accounts), thêm dòng vào{' '}
                      <code className="text-crm-primary">tkqc_accounts</code>, rồi &quot;Tạo yêu cầu&quot;.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const pending = r.trang_thai === 'cho_phe_duyet';
                    const duAn = r.tkqc_accounts?.don_vi != null && String(r.tkqc_accounts.don_vi).trim() !== ''
                      ? r.tkqc_accounts.don_vi
                      : '—';
                    const tkqcLabel = r.tkqc_accounts?.tkqc || '—';
                    return (
                      <tr key={r.id} className="hover:bg-crm-surface-accent/25 transition-colors align-top">
                        <td className="px-3 py-3 text-sm text-crm-on-surface truncate" title={duAn}>
                          {duAn}
                        </td>
                        <td className="px-3 py-3 text-sm font-medium text-crm-on-surface truncate" title={tkqcLabel}>
                          {tkqcLabel}
                        </td>
                        <td className="px-3 py-3 text-sm font-semibold text-crm-on-surface text-right tabular-nums whitespace-nowrap">
                          {formatVnd(Number(r.ngan_sach_xin) || 0)}
                        </td>
                        <td className="px-3 py-3 text-sm text-crm-on-surface whitespace-nowrap">
                          {new Date(r.ngay_gio_xin).toLocaleString('vi-VN', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusBadgeClass(r.trang_thai)}`}>
                            {STATUS_LABEL[r.trang_thai]}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs text-crm-on-surface-variant">
                          {r.trang_thai === 'tu_choi' && r.ly_do_tu_choi ? (
                            <span>
                              <span className="text-crm-error font-semibold">Từ chối: </span>
                              {r.ly_do_tu_choi}
                            </span>
                          ) : (
                            <span className="line-clamp-2">{r.ghi_chu || '—'}</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setViewRow(r)}
                              className="p-1.5 rounded-lg text-crm-on-surface-variant hover:text-crm-primary hover:bg-crm-primary/10"
                              title="Xem"
                            >
                              <Eye size={16} />
                            </button>
                            {pending && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openEdit(r)}
                                  disabled={saving}
                                  className="p-1.5 rounded-lg text-crm-on-surface-variant hover:text-crm-secondary hover:bg-crm-secondary/10 disabled:opacity-40"
                                  title="Sửa"
                                >
                                  <Pencil size={16} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(r)}
                                  disabled={saving}
                                  className="p-1.5 rounded-lg text-crm-on-surface-variant hover:text-crm-error hover:bg-crm-error/10 disabled:opacity-40"
                                  title="Xóa"
                                >
                                  <Trash2 size={16} />
                                </button>
                                <div className="relative inline-block" ref={menuOpenId === r.id ? menuRef : undefined}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setMenuOpenId((id) => (id === r.id ? null : r.id));
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide bg-crm-primary/15 text-crm-primary border border-crm-primary/30 hover:bg-crm-primary/25"
                                  >
                                    Phê duyệt
                                    <ChevronDown size={14} />
                                  </button>
                                  {menuOpenId === r.id && (
                                    <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] crm-glass-card rounded-xl border border-crm-outline/50 py-1 shadow-xl">
                                      <button
                                        type="button"
                                        className="w-full text-left px-3 py-2 text-xs font-semibold text-crm-success hover:bg-crm-success/10"
                                        onClick={() => handleApprove(r.id)}
                                      >
                                        Đồng ý
                                      </button>
                                      <button
                                        type="button"
                                        className="w-full text-left px-3 py-2 text-xs font-semibold text-crm-error hover:bg-crm-error/10"
                                        onClick={() => openReject(r)}
                                      >
                                        Từ chối
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Xem */}
      {viewRow && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" role="dialog">
          <div className="crm-glass-card max-w-md w-full rounded-2xl border border-crm-outline/40 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-crm-on-surface mb-4">Chi tiết yêu cầu</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-crm-on-surface-variant shrink-0">Dự án</dt>
                <dd className="font-medium text-crm-on-surface text-right">{viewRow.tkqc_accounts?.don_vi?.trim() || '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-crm-on-surface-variant shrink-0">TKQC</dt>
                <dd className="font-medium text-crm-on-surface text-right">{viewRow.tkqc_accounts?.tkqc || '—'}</dd>
              </div>
              {viewRow.tkqc_accounts?.page && (
                <div className="flex justify-between gap-4">
                  <dt className="text-crm-on-surface-variant shrink-0">Page</dt>
                  <dd className="text-crm-on-surface text-right text-xs">{viewRow.tkqc_accounts.page}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-crm-on-surface-variant">Xin ngân sách</dt>
                <dd className="font-semibold text-crm-on-surface tabular-nums">{formatVnd(Number(viewRow.ngan_sach_xin) || 0)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-crm-on-surface-variant">Ngày giờ xin</dt>
                <dd className="text-crm-on-surface">{new Date(viewRow.ngay_gio_xin).toLocaleString('vi-VN')}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-crm-on-surface-variant">Trạng thái</dt>
                <dd>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${statusBadgeClass(viewRow.trang_thai)}`}>
                    {STATUS_LABEL[viewRow.trang_thai]}
                  </span>
                </dd>
              </div>
              {viewRow.ghi_chu && (
                <div>
                  <dt className="text-crm-on-surface-variant mb-1">Ghi chú</dt>
                  <dd className="text-crm-on-surface">{viewRow.ghi_chu}</dd>
                </div>
              )}
              {viewRow.trang_thai === 'tu_choi' && viewRow.ly_do_tu_choi && (
                <div>
                  <dt className="text-crm-on-surface-variant mb-1">Lý do từ chối</dt>
                  <dd className="text-crm-error">{viewRow.ly_do_tu_choi}</dd>
                </div>
              )}
            </dl>
            <button
              type="button"
              onClick={() => setViewRow(null)}
              className="mt-6 w-full py-2.5 rounded-xl bg-crm-surface-accent text-crm-on-surface font-semibold border border-crm-outline/50 hover:bg-crm-surface-accent/80"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Sửa */}
      {editRow && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" role="dialog">
          <form onSubmit={handleSaveEdit} className="crm-glass-card max-w-md w-full rounded-2xl border border-crm-outline/40 p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-crm-on-surface mb-4">Sửa yêu cầu</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Dự án (đơn vị)</label>
                <select
                  required
                  value={editProjectKey}
                  onChange={(e) => {
                    const key = e.target.value;
                    setEditProjectKey(key);
                    const list = tkqcAccounts.filter((a) => projectKeyFromDonVi(a.don_vi) === key);
                    setEditTkqcId(list[0]?.id || '');
                  }}
                  className="mt-1 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-2.5 text-crm-on-surface text-sm"
                >
                  {projectKeys.map((k) => (
                    <option key={k} value={k}>
                      {labelProject(k)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Tài khoản TKQC</label>
                <select
                  required
                  value={editTkqcId}
                  onChange={(e) => setEditTkqcId(e.target.value)}
                  className="mt-1 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-2.5 text-crm-on-surface text-sm"
                >
                  {editTkqcId && !accountsForEdit.some((a) => a.id === editTkqcId) && (
                    <option value={editTkqcId}>— (tài khoản đã lưu)</option>
                  )}
                  {accountsForEdit.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.tkqc}
                      {a.page ? ` — ${a.page}` : ''}
                    </option>
                  ))}
                </select>
                {accountsForEdit.length === 0 && (
                  <p className="text-[11px] text-crm-warning mt-1">Không có TKQC cho dự án này trong {TKQC_TABLE}</p>
                )}
              </div>
              <div>
                <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Xin ngân sách (VND)</label>
                <input
                  required
                  value={formatDigitsDisplay(editAmountDigits)}
                  onChange={(e) => setEditAmountDigits(e.target.value.replace(/\D/g, ''))}
                  className="mt-1 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-2.5 text-crm-on-surface tabular-nums text-right"
                  placeholder="0"
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Ngày giờ xin</label>
                <input
                  type="datetime-local"
                  required
                  value={editDatetime}
                  onChange={(e) => setEditDatetime(e.target.value)}
                  className="mt-1 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-2.5 text-crm-on-surface"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Ghi chú</label>
                <textarea
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  rows={2}
                  className="mt-1 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-2.5 text-crm-on-surface text-sm"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setEditRow(null)}
                className="flex-1 py-2.5 rounded-xl border border-crm-outline/50 text-crm-on-surface font-semibold"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving || accountsForEdit.length === 0}
                className="flex-1 py-2.5 rounded-xl bg-crm-primary text-white font-bold disabled:opacity-50"
              >
                {saving ? 'Đang lưu…' : 'Lưu'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tạo mới */}
      {createOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" role="dialog">
          <form onSubmit={handleCreate} className="crm-glass-card max-w-md w-full rounded-2xl border border-crm-outline/40 p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-crm-on-surface mb-4">Tạo yêu cầu xin ngân sách</h3>
            <p className="text-xs text-crm-on-surface-variant mb-4">
              Trạng thái ban đầu: <strong className="text-crm-warning">Chờ phê duyệt</strong>
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Dự án (đơn vị)</label>
                <select
                  required
                  value={createProjectKey}
                  onChange={(e) => {
                    const key = e.target.value;
                    setCreateProjectKey(key);
                    const list = tkqcAccounts.filter((a) => projectKeyFromDonVi(a.don_vi) === key);
                    setCreateTkqcId(list[0]?.id || '');
                  }}
                  className="mt-1 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-2.5 text-crm-on-surface text-sm"
                >
                  {projectKeys.map((k) => (
                    <option key={k} value={k}>
                      {labelProject(k)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Tài khoản TKQC</label>
                <select
                  required
                  value={createTkqcId}
                  onChange={(e) => setCreateTkqcId(e.target.value)}
                  className="mt-1 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-2.5 text-crm-on-surface text-sm"
                >
                  {accountsForCreate.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.tkqc}
                      {a.page ? ` — ${a.page}` : ''}
                    </option>
                  ))}
                </select>
                {accountsForCreate.length === 0 && (
                  <p className="text-[11px] text-crm-warning mt-1">Thêm dòng vào {TKQC_TABLE} cho dự án này</p>
                )}
              </div>
              <div>
                <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Số tiền xin (VND)</label>
                <input
                  required
                  value={formatDigitsDisplay(createAmountDigits)}
                  onChange={(e) => setCreateAmountDigits(e.target.value.replace(/\D/g, ''))}
                  className="mt-1 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-2.5 text-crm-on-surface tabular-nums text-right"
                  placeholder="0"
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Ngày giờ xin</label>
                <input
                  type="datetime-local"
                  required
                  value={createDatetime}
                  onChange={(e) => setCreateDatetime(e.target.value)}
                  className="mt-1 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-2.5 text-crm-on-surface"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-crm-on-surface-variant uppercase">Ghi chú (tuỳ chọn)</label>
                <textarea
                  value={createNote}
                  onChange={(e) => setCreateNote(e.target.value)}
                  rows={2}
                  className="mt-1 w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-2.5 text-crm-on-surface text-sm"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-crm-outline/50 text-crm-on-surface font-semibold"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving || accountsForCreate.length === 0 || !createTkqcId}
                className="flex-1 py-2.5 rounded-xl bg-crm-primary text-white font-bold disabled:opacity-50"
              >
                {saving ? 'Đang gửi…' : 'Gửi yêu cầu'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Từ chối — lý do */}
      {rejectRow && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" role="dialog">
          <form onSubmit={handleRejectSubmit} className="crm-glass-card max-w-md w-full rounded-2xl border border-crm-outline/40 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-crm-on-surface mb-2">Từ chối yêu cầu</h3>
            <p className="text-xs text-crm-on-surface-variant mb-4">Vui lòng nhập lý do từ chối (bắt buộc).</p>
            <textarea
              required
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              placeholder="Nhập lý do…"
              className="w-full bg-crm-surface-accent/40 border border-crm-outline/50 rounded-xl px-4 py-2.5 text-crm-on-surface text-sm"
            />
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setRejectRow(null);
                  setRejectReason('');
                }}
                className="flex-1 py-2.5 rounded-xl border border-crm-outline/50 text-crm-on-surface font-semibold"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-crm-error/90 text-white font-bold disabled:opacity-50"
              >
                {saving ? 'Đang lưu…' : 'Xác nhận từ chối'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
