import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, Plus, X, Send } from 'lucide-react';
import { supabase } from '../../api/supabase';
import type { AuthUser, UserRole, StaffRecord, DraftReportRow, ReportModalVariant } from '../../types';
import backgroundImg from '../../assets/background.png';


const REPORT_TABLE = import.meta.env.VITE_SUPABASE_REPORTS_TABLE?.trim() || 'detail_reports';
const EMPLOYEES_TABLE = import.meta.env.VITE_SUPABASE_EMPLOYEES_TABLE?.trim() || 'employees';
const MARKETING_STAFF_TABLE = import.meta.env.VITE_SUPABASE_MARKETING_STAFF_TABLE?.trim() || 'marketing_staff';
const SYSTEM_SETTINGS_TABLE = import.meta.env.VITE_SUPABASE_SYSTEM_SETTINGS_TABLE?.trim() || 'system_settings';

const DEFAULT_ROLE = (import.meta.env.VITE_USER_ROLE?.trim()?.toLowerCase() || 'user') as UserRole;
const DEFAULT_USER_NAME = import.meta.env.VITE_USER_NAME?.trim() || '';
const DEFAULT_USER_EMAIL = import.meta.env.VITE_USER_EMAIL?.trim() || '';

const MARKET_OPTIONS = ['Nhật Bản', 'Hàn Quốc', 'Canada', 'US', 'Úc', 'Anh', 'CĐ Nhật Bản'];
const PRIVILEGED_ROLES = new Set<UserRole>(['admin', 'manager', 'director']);

const createEmptyRow = (currentUser: AuthUser): DraftReportRow => ({
  name: currentUser.name,
  email: currentUser.email,
  report_date: new Date().toISOString().slice(0, 10),
  product: '',
  market: '',
  ad_account: '',
  ad_cost: '',
  mess_comment_count: '',
  order_count: '',
  revenue: '',
  team: currentUser.team,
});

function toNullableNumber(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized.replace(/,/g, ''));
  return Number.isNaN(parsed) ? null : parsed;
}

function toNullableInteger(value: string) {
  const num = toNullableNumber(value);
  if (num === null) return null;
  return Math.trunc(num);
}

function formatCurrency(value: string): string {
  if (!value.trim()) return '';
  const num = toNullableNumber(value);
  if (num === null) return value;
  return num.toLocaleString('vi-VN');
}


export function ReportModal({
  onClose,
  currentUser,
  variant = 'modal',
  embeddedRootId = 'crm-reports-daily',
}: {
  onClose?: () => void;
  currentUser?: AuthUser;
  variant?: ReportModalVariant;
  embeddedRootId?: string;
}) {
  const embedded = variant === 'embedded';
  const resolvedUser: AuthUser = currentUser || {
    id: '',
    email: DEFAULT_USER_EMAIL,
    name: DEFAULT_USER_NAME,
    role: DEFAULT_ROLE,
    team: '',
    avatar_url: null,
  };

  const [rows, setRows] = useState<DraftReportRow[]>([createEmptyRow(resolvedUser)]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);
  const [staffs, setStaffs] = useState<StaffRecord[]>([]);
  const [products, setProducts] = useState<string[]>([]);

  const canEditIdentity = PRIVILEGED_ROLES.has(resolvedUser.role);

  useEffect(() => {
    const fetchMeta = async () => {
      setIsLoadingMeta(true);

      const [{ data: staffData, error: staffError }, { data: productData, error: productError }] = await Promise.all([
        supabase.from(MARKETING_STAFF_TABLE).select('*').order('name', { ascending: true }),
        supabase.from(SYSTEM_SETTINGS_TABLE).select('*').neq('type', 'test'),
      ]);

      if (staffError) {
        console.error('Error loading marketing staff:', staffError);
      } else {
        const normalizedStaffs = (staffData || []).map((row: Record<string, unknown>) => ({
          name: String(row.name ?? row.ten ?? ''),
          email: String(row.email ?? ''),
          team: String(row.team ?? ''),
          id_ns: String(row.id_ns ?? row.staff_id ?? ''),
          branch: String(row.branch ?? row.chi_nhanh ?? ''),
        }));
        setStaffs(normalizedStaffs.filter((s) => s.name || s.email));
      }

      if (productError) {
        console.error('Error loading product settings:', productError);
      } else {
        const values = (productData || [])
          .map((row: Record<string, unknown>) => String(row.value ?? row.product ?? row.name ?? '').trim())
          .filter(Boolean);
        setProducts(Array.from(new Set(values)));
      }

      setIsLoadingMeta(false);
    };

    fetchMeta();
  }, []);

  const staffByName = useMemo(() => {
    const map = new Map<string, StaffRecord>();
    staffs.forEach((s) => map.set(s.name.toLowerCase(), s));
    return map;
  }, [staffs]);

  const staffByEmail = useMemo(() => {
    const map = new Map<string, StaffRecord>();
    staffs.forEach((s) => map.set(s.email.toLowerCase(), s));
    return map;
  }, [staffs]);

  const applyStaffInfo = (base: DraftReportRow, staff?: StaffRecord): DraftReportRow => {
    if (!staff) return base;
    return {
      ...base,
      name: staff.name || base.name,
      email: staff.email || base.email,
      team: staff.team || '',
    };
  };

  const updateRow = (index: number, updater: (row: DraftReportRow) => DraftReportRow) => {
    setRows((prev) => prev.map((row, i) => (i === index ? updater(row) : row)));
  };

  const handleNameChange = (index: number, value: string) => {
    updateRow(index, (row) => applyStaffInfo({ ...row, name: value }, staffByName.get(value.toLowerCase())));
  };

  const handleEmailChange = (index: number, value: string) => {
    updateRow(index, (row) => applyStaffInfo({ ...row, email: value }, staffByEmail.get(value.toLowerCase())));
  };

  const addRow = () => {
    setRows((prev) => [...prev, createEmptyRow(resolvedUser)]);
  };

  const copyRow = (index: number) => {
    setRows((prev) => {
      const source = prev[index];
      const copied = {
        ...createEmptyRow(resolvedUser),
        name: source.name,
        email: source.email,
        product: source.product,
        market: source.market,
      };
      const next = [...prev];
      next.splice(index + 1, 0, copied);
      return next;
    });
  };

  const removeRow = (index: number) => {
    if (rows.length === 1) return;
    if (!confirm('Bạn có chắc muốn xóa dòng này?')) return;
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const submitReports = async () => {
    const invalidRow = rows.find((r) => !r.name.trim() || !r.email.trim() || !r.report_date);
    if (invalidRow) {
      alert('Vui lòng nhập đủ Tên, Email và Ngày cho tất cả các dòng.');
      return;
    }

    setIsSubmitting(true);
    const payload = rows.map((r) => ({
      name: r.name.trim(),
      email: r.email.trim(),
      report_date: r.report_date,
      product: r.product || null,
      market: r.market || null,
      ad_account: r.ad_account || null,
      ad_cost: toNullableNumber(r.ad_cost),
      mess_comment_count: toNullableInteger(r.mess_comment_count),
      order_count: toNullableInteger(r.order_count),
      revenue: toNullableNumber(r.revenue),
      team: r.team || null,
    }));

    const { error } = await supabase.from(REPORT_TABLE).insert(payload);
    setIsSubmitting(false);

    if (error) {
      console.error('Error sending reports:', error);
      alert(`Gửi báo cáo thất bại: ${error.message}`);
      return;
    }

    alert('Gửi báo cáo thành công.');
    setRows([createEmptyRow(resolvedUser)]);
  };

  const shell = (
    <motion.div
      initial={embedded ? false : { scale: 0.95, y: 12 }}
      animate={embedded ? false : { scale: 1, y: 0 }}
      className={
        embedded
          ? 'w-full max-w-full min-h-[min(70vh,720px)] max-h-[calc(100vh-10rem)] bg-gradient-to-br from-emerald-950/35 to-crm-surface/80 border border-emerald-500/25 rounded-2xl flex flex-col overflow-hidden crm-glass-card shadow-[0_0_40px_rgba(34,197,94,0.08)] ring-1 ring-emerald-500/20'
          : 'mx-auto h-full max-w-[98vw] bg-emerald-950/50 border border-emerald-500/35 rounded-2xl flex flex-col overflow-hidden backdrop-blur-sm shadow-[0_0_40px_rgba(34,197,94,0.12)] ring-1 ring-emerald-500/20'
      }
      style={
        embedded
          ? undefined
          : { backgroundImage: `url(${backgroundImg})`, backgroundSize: 'cover', backgroundPosition: 'center' }
      }
    >
      <div className="px-4 py-3 border-b border-emerald-500/30 bg-emerald-950/50 backdrop-blur-sm flex items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className={`font-bold text-lg ${embedded ? 'text-crm-on-surface' : 'text-white'}`}>
            Bảng Báo Cáo Marketing
          </h2>
          <p className={`text-xs ${embedded ? 'text-emerald-200/70' : 'text-emerald-100/60'}`}>
            Nhập theo ngày và gửi trực tiếp vào Supabase ({REPORT_TABLE})
          </p>
        </div>
        {!embedded && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-emerald-200/60 hover:text-white hover:bg-emerald-500/20 shrink-0"
          >
            <X size={20} />
          </button>
        ) : null}
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {isLoadingMeta ? (
          <div
            className={`h-full min-h-[160px] flex items-center justify-center gap-2 ${embedded ? 'text-crm-on-surface-variant' : 'text-white/70'}`}
          >
            <Loader2 className="animate-spin" size={20} />
            Đang tải dữ liệu gợi ý...
          </div>
        ) : (
          <table className="min-w-[1800px] w-full text-sm">
            <thead className="sticky top-0 z-10 bg-emerald-900/60 backdrop-blur border-b border-emerald-500/30">
              <tr className="text-emerald-200 text-xs uppercase">
                <th className="p-2 text-left">Tên</th>
                <th className="p-2 text-left">Ngày</th>
                <th className="p-2 text-left">Sản phẩm</th>
                <th className="p-2 text-left">Thị trường</th>
                <th className="p-2 text-left">TKQC</th>
                <th className="p-2 text-left">CPQC</th>
                <th className="p-2 text-left">Số Mess/Cmt</th>
                <th className="p-2 text-left">Số đơn</th>
                <th className="p-2 text-left">Doanh số</th>
                <th className="p-2 text-left">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-b border-emerald-500/10 text-white/90 hover:bg-emerald-500/10 transition-colors">
                  <td className="p-1.5"><input list="staff-name-options" value={row.name} disabled={!canEditIdentity} onChange={(e) => handleNameChange(index, e.target.value)} className="w-[160px] bg-emerald-800/60 border border-emerald-500/50 rounded px-2 py-1 disabled:opacity-50 focus:bg-emerald-700/70 focus:border-emerald-400" /></td>
                  <td className="p-1.5"><input type="date" value={row.report_date} onChange={(e) => updateRow(index, (r) => ({ ...r, report_date: e.target.value }))} className="w-[140px] bg-emerald-800/60 border border-emerald-500/50 rounded px-2 py-1 focus:bg-emerald-700/70 focus:border-emerald-400" /></td>
                  <td className="p-1.5"><input list="product-options" value={row.product} onChange={(e) => updateRow(index, (r) => ({ ...r, product: e.target.value }))} className="w-[140px] bg-emerald-800/60 border border-emerald-500/50 rounded px-2 py-1 focus:bg-emerald-700/70 focus:border-emerald-400" /></td>
                  <td className="p-1.5"><input list="market-options" value={row.market} onChange={(e) => updateRow(index, (r) => ({ ...r, market: e.target.value }))} className="w-[130px] bg-emerald-800/60 border border-emerald-500/50 rounded px-2 py-1 focus:bg-emerald-700/70 focus:border-emerald-400" /></td>
                  <td className="p-1.5"><input value={row.ad_account} onChange={(e) => updateRow(index, (r) => ({ ...r, ad_account: e.target.value }))} className="w-[120px] bg-emerald-800/60 border border-emerald-500/50 rounded px-2 py-1 focus:bg-emerald-700/70 focus:border-emerald-400" /></td>
                  <td className="p-1.5"><input value={formatCurrency(row.ad_cost)} onChange={(e) => updateRow(index, (r) => ({ ...r, ad_cost: e.target.value.replace(/\./g, '') }))} className="w-[110px] bg-emerald-800/60 border border-emerald-500/50 rounded px-2 py-1 focus:bg-emerald-700/70 focus:border-emerald-400" placeholder="0" /></td>
                  <td className="p-1.5"><input value={row.mess_comment_count} onChange={(e) => updateRow(index, (r) => ({ ...r, mess_comment_count: e.target.value }))} className="w-[110px] bg-emerald-800/60 border border-emerald-500/50 rounded px-2 py-1 focus:bg-emerald-700/70 focus:border-emerald-400" /></td>
                  <td className="p-1.5"><input value={row.order_count} onChange={(e) => updateRow(index, (r) => ({ ...r, order_count: e.target.value }))} className="w-[100px] bg-emerald-800/60 border border-emerald-500/50 rounded px-2 py-1 focus:bg-emerald-700/70 focus:border-emerald-400" /></td>
                  <td className="p-1.5"><input value={formatCurrency(row.revenue)} onChange={(e) => updateRow(index, (r) => ({ ...r, revenue: e.target.value.replace(/\./g, '') }))} className="w-[110px] bg-emerald-800/60 border border-emerald-500/50 rounded px-2 py-1 focus:bg-emerald-700/70 focus:border-emerald-400" placeholder="0" /></td>
                  <td className="p-1.5">
                    <div className="flex gap-1">
                      <button onClick={() => copyRow(index)} className="px-2 py-1 rounded bg-emerald-500/30 text-emerald-200 hover:bg-emerald-500/50 transition-colors">➕</button>
                      <button onClick={() => removeRow(index)} disabled={rows.length === 1} className="px-2 py-1 rounded bg-red-500/30 text-red-200 hover:bg-red-500/50 transition-colors disabled:opacity-40">❌</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="px-4 py-3 border-t border-emerald-500/30 bg-emerald-900/40 backdrop-blur-sm flex items-center gap-2">
        <button onClick={addRow} className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100 text-sm flex items-center gap-1 transition-colors">
          <Plus size={16} /> Thêm dòng
        </button>
        <button onClick={submitReports} disabled={isSubmitting} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50 ml-auto flex items-center gap-2 transition-colors shadow-[0_0_20px_rgba(34,197,94,0.35)]">
          {isSubmitting && <Loader2 size={16} className="animate-spin" />}
          <Send size={16} /> Gửi báo cáo
        </button>
      </div>

      <datalist id="staff-name-options">{staffs.map((s) => <option key={`${s.email}-name`} value={s.name} />)}</datalist>
      <datalist id="staff-email-options">{staffs.map((s) => <option key={`${s.email}-email`} value={s.email} />)}</datalist>
      <datalist id="market-options">{MARKET_OPTIONS.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="product-options">{products.map((p) => <option key={p} value={p} />)}</datalist>
    </motion.div>
  );

  if (embedded) {
    return (
      <div id={embeddedRootId} className="w-full mb-8">
        {shell}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-sm p-4"
    >
      {shell}
    </motion.div>
  );
}
