import React from 'react';
import { SectionCard, Badge } from '../../../components/crm-dashboard/atoms/SharedAtoms';

export const LeaderBudgetView: React.FC = () => {
  return (
    <div className="dash-fade-up space-y-[14px]">
      {/* Create Request Form */}
      <SectionCard title="💰 Tạo yêu cầu nạp ngân sách">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[20px] mb-[20px]">
          <div>
            <label className="block text-[10px] font-bold text-[var(--text3)] uppercase tracking-[1px] mb-[8px]">Dự án</label>
            <select className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-[8px] p-[10px_14px] text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-all">
              <option>BIOKAMA</option>
              <option>FABICO</option>
              <option>MASSHU</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[var(--text3)] uppercase tracking-[1px] mb-[8px]">Agency</label>
            <select className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-[8px] p-[10px_14px] text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-all">
              <option>Media One</option>
              <option>AdsViet</option>
              <option>DigiMedia</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[var(--text3)] uppercase tracking-[1px] mb-[8px]">Mức độ ưu tiên</label>
            <select className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-[8px] p-[10px_14px] text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-all">
              <option>Cao</option>
              <option>Trung bình</option>
              <option>Thấp</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-[20px] mb-[20px]">
          <div>
            <label className="block text-[10px] font-bold text-[var(--text3)] uppercase tracking-[1px] mb-[8px]">Tài khoản ADS cần nạp</label>
            <input 
              type="text" 
              placeholder="TK-001, TK-002, TK-003"
              className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-[8px] p-[10px_14px] text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-all"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[var(--text3)] uppercase tracking-[1px] mb-[8px]">Loại tiền</label>
            <select className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-[8px] p-[10px_14px] text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-all">
              <option>VNĐ</option>
              <option>USD</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-[20px] mb-[24px]">
          <div>
            <label className="block text-[10px] font-bold text-[var(--text3)] uppercase tracking-[1px] mb-[8px]">Số tiền đề nghị nạp</label>
            <input 
              type="text" 
              placeholder="VD: 150.000.000"
              className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-[8px] p-[10px_14px] text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-all"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[var(--text3)] uppercase tracking-[1px] mb-[8px]">Lý do nạp</label>
            <input 
              type="text" 
              placeholder="Mô tả lý do..."
              className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-[8px] p-[10px_14px] text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-all"
            />
          </div>
        </div>

        <button className="flex items-center gap-[8px] bg-[#3d8ef0] hover:bg-[#2e7dd1] text-white p-[10px_24px] rounded-[8px] text-[12px] font-bold transition-all shadow-[0_4px_16px_rgba(61,142,240,0.3)]">
          📩 Gửi yêu cầu lên Admin
        </button>
      </SectionCard>

      {/* History Table */}
      <SectionCard title="📋 Lịch sử yêu cầu — Team A" bodyPadding={false}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] text-[9px] font-bold tracking-[1px] uppercase text-[var(--text3)] text-left">
                <th className="p-[14px_16px]">Mã YC</th>
                <th className="p-[14px_16px]">Agency</th>
                <th className="p-[14px_16px] text-right">Số tiền</th>
                <th className="p-[14px_16px]">Ngày gửi</th>
                <th className="p-[14px_16px]">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="text-[11.5px] text-[var(--text2)]">
              <tr className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.015)] transition-colors">
                <td className="p-[14px_16px] font-bold text-[#3d8ef0]">YC-031</td>
                <td className="p-[14px_16px]">Media One</td>
                <td className="p-[14px_16px] text-right font-[var(--mono)] font-bold text-[var(--text)]">150.000.000</td>
                <td className="p-[14px_16px] text-[var(--text3)]">25/03/2025</td>
                <td className="p-[14px_16px]">
                  <Badge type="Y">⏳ Chờ duyệt</Badge>
                </td>
              </tr>
              <tr className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.015)] transition-colors">
                <td className="p-[14px_16px] font-bold text-[#3d8ef0]">YC-028</td>
                <td className="p-[14px_16px]">Media One</td>
                <td className="p-[14px_16px] text-right font-[var(--mono)] font-bold text-[var(--text)]">120.000.000</td>
                <td className="p-[14px_16px] text-[var(--text3)]">20/03/2025</td>
                <td className="p-[14px_16px]">
                  <Badge type="G">✓ Đã duyệt</Badge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
};
