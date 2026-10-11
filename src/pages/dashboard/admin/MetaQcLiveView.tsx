import React, { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { SectionCard } from '../../../components/crm-dashboard/atoms/SharedAtoms';
import type { MetaQcResult } from '../../../api/metaQc';
import { formatFullVnd, formatReportDateVi } from '../mkt/mktDetailReportShared';
import { MetaQcImportModal } from './MetaQcImportModal';

const PAGE_SIZE = 50;
function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function MetaQcLiveView() {
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [range, setRange] = useState({ since: from, until: to });
  const [results, setResults] = useState<Record<string, MetaQcResult>>({});
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const days = (Date.parse(to) - Date.parse(from)) / 86400000;
  const validRange = !!from && !!to && Number.isFinite(days) && days >= 0 && days <= 30;
  const rows = useMemo(() => Object.values(results).flatMap(result => result.rows.map((row, index) => ({
    ...row, account: result.account_id, timezone: result.account_timezone, key: `${result.account_id}:${index}`,
  }))).sort((a, b) => b.ngay.localeCompare(a.ngay) || a.account.localeCompare(b.account)), [results]);
  const totalSpend = rows.reduce((sum, row) => sum + row.so_tien_da_chi_tieu_vnd, 0);
  const totalConversations = rows.reduce((sum, row) => sum + row.so_tro_chuyen_tin_nhan, 0);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;

  const load = () => {
    if (!validRange) return;
    if (from !== range.since || to !== range.until) setResults({});
    setRange({ since: from, until: to });
    setPage(1);
    setOpen(true);
  };

  return <SectionCard title="Dữ liệu QC từ Meta" subtitle={`${rows.length} dòng · ${range.since} → ${range.until}`}>
    {open && <MetaQcImportModal since={range.since} until={range.until} onClose={() => setOpen(false)}
      onLoaded={result => {
        setResults(current => ({ ...current, [result.account_id]: result }));
        setPage(1);
      }} />}
    <div className="space-y-4 text-[var(--text)]">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs">Từ ngày
          <input type="date" value={from} disabled={open} onChange={event => setFrom(event.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg3)] p-2" />
        </label>
        <label className="flex flex-col gap-1 text-xs">Đến ngày
          <input type="date" value={to} disabled={open} onChange={event => setTo(event.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg3)] p-2" />
        </label>
        <button type="button" onClick={load} disabled={open || !validRange}
          className="flex items-center gap-2 rounded-lg bg-[#1877f2] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
          <Download size={14} /> Lấy từ API Meta
        </button>
      </div>
      {!validRange && <p role="alert" className="text-xs text-red-500">Chọn khoảng ngày hợp lệ, tối đa 31 ngày.</p>}
      <p className="text-xs text-[var(--text3)]">Dữ liệu xem trực tiếp theo ngày và chiến dịch. Tải lại trang cần lấy lại dữ liệu. Khi lấy lại cùng khoảng ngày, kết quả thành công thay thế dữ liệu của từng tài khoản; tài khoản lỗi giữ kết quả lần trước.</p>
      <div className="flex flex-wrap gap-6 rounded-lg bg-[var(--bg3)] p-4 text-sm">
        <span>Chi tiêu: <strong>{formatFullVnd(totalSpend)} VND</strong></span>
        <span>Trò chuyện: <strong>{totalConversations.toLocaleString('vi-VN')}</strong></span>
        <span>Đã tải: <strong>{Object.keys(results).length} tài khoản</strong></span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead><tr className="border-b border-[var(--border)] text-[var(--text3)]">
            {['Tài khoản', 'Ngày', 'Mã NV', 'Tên chiến dịch', 'Chi tiêu (VND)', 'Trò chuyện'].map(label => <th key={label} className="p-2">{label}</th>)}
          </tr></thead>
          <tbody>{rows.slice(start, start + PAGE_SIZE).map(row => <tr key={row.key} className="border-b border-[var(--border)]">
            <td className="p-2" title={`Múi giờ: ${row.timezone}`}>{row.account}</td>
            <td className="whitespace-nowrap p-2">{formatReportDateVi(row.ngay)}</td>
            <td className="p-2">{row.ma_nv || '—'}</td>
            <td className="max-w-[360px] truncate p-2" title={row.ten_chien_dich}>{row.ten_chien_dich}</td>
            <td className="p-2">{formatFullVnd(row.so_tien_da_chi_tieu_vnd)}</td>
            <td className="p-2">{row.so_tro_chuyen_tin_nhan.toLocaleString('vi-VN')}</td>
          </tr>)}
          {!rows.length && <tr><td colSpan={6} className="p-10 text-center text-[var(--text3)]">{Object.keys(results).length ? 'Không có dữ liệu trong các tài khoản đã tải ở khoảng ngày này.' : 'Chọn khoảng ngày và bấm Lấy từ API Meta để xem dữ liệu.'}</td></tr>}
          </tbody>
        </table>
      </div>
      {rows.length > PAGE_SIZE && <div className="flex items-center justify-between text-xs">
        <span>{start + 1}–{Math.min(start + PAGE_SIZE, rows.length)} / {rows.length} dòng</span>
        <div className="flex items-center gap-3">
          <button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} className="disabled:opacity-40">Trước</button>
          <span>{currentPage}/{totalPages}</span>
          <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)} className="disabled:opacity-40">Sau</button>
        </div>
      </div>}
    </div>
  </SectionCard>;
}
