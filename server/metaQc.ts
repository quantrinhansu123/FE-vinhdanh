import type { MetaReport } from './metaClient.js';
import { MetaError } from './metaClient.js';

export function metaReportToQcRows(report: MetaReport) {
  const grouped = new Map<string, {
    ngay: string; ma_nv: string | null; ten_chien_dich: string;
    so_tien_da_chi_tieu_vnd: number; so_tro_chuyen_tin_nhan: number;
  }>();
  for (const ad of report.data) {
    if (ad.account_currency !== 'VND') throw new MetaError(422, 'meta_currency_unsupported',
      'Tài khoản này không dùng VND. Chưa nhập dữ liệu để tránh sai đơn vị tiền.');
    if (!ad.campaign_id || !ad.campaign_name.trim()) throw new MetaError(502, 'meta_invalid_response', 'Meta thiếu thông tin chiến dịch.');
    const key = `${ad.date_start}:${ad.campaign_id}`;
    const row = grouped.get(key) || {
      ngay: ad.date_start, ma_nv: ad.campaign_name.match(/\[([^\]]+)\]/)?.[1]?.trim() || null,
      ten_chien_dich: ad.campaign_name, so_tien_da_chi_tieu_vnd: 0, so_tro_chuyen_tin_nhan: 0,
    };
    row.so_tien_da_chi_tieu_vnd += Number(ad.spend);
    // One action type only; overlapping messaging metrics must not be added.
    row.so_tro_chuyen_tin_nhan += Number(ad.actions.find(action =>
      action.action_type === 'onsite_conversion.messaging_conversation_started_7d')?.value || 0);
    grouped.set(key, row);
  }
  return [...grouped.values()].map(row => ({ ...row,
    so_tien_da_chi_tieu_vnd: Math.round(row.so_tien_da_chi_tieu_vnd * 100) / 100,
    so_tro_chuyen_tin_nhan: Math.round(row.so_tro_chuyen_tin_nhan * 10000) / 10000,
  }));
}
