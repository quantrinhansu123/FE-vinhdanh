import React from 'react';
import { SectionCard, Badge } from '../../../components/crm-dashboard/atoms/SharedAtoms';

export const TeamsView: React.FC = () => {
  return (
    <div className="dash-fade-up">
      <SectionCard 
        title="👥 Module 2 — Quản lý Team" 
        actions={<button className="bg-[#3d8ef0] hover:bg-[#2e7dd1] text-white py-[6px] px-[13px] rounded-[6px] text-[11px] font-bold transition-all shadow-[0_4px_12px_rgba(61,142,240,0.25)]">+ Thêm team</button>}
        bodyPadding={false}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] text-[9px] font-bold tracking-[1px] uppercase text-[var(--text3)] text-left">
                <th className="p-[12px_16px]">MÃ TEAM</th>
                <th className="p-[12px_16px]">TÊN TEAM</th>
                <th className="p-[12px_16px]">LEADER</th>
                <th className="p-[12px_16px] text-center">SỐ THÀNH VIÊN</th>
                <th className="p-[12px_16px]">DỰ ÁN PHỤ TRÁCH</th>
                <th className="p-[12px_16px] text-right">DOANH SỐ THÁNG</th>
                <th className="p-[12px_16px]">TRẠNG THÁI</th>
                <th className="p-[12px_16px]"></th>
              </tr>
            </thead>
            <tbody className="text-[11.5px] text-[var(--text2)]">
              {/* Row 1 */}
              <tr className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.015)] transition-colors">
                <td className="p-[12px_16px] font-bold text-[#3d8ef0]">TEAM-A</td>
                <td className="p-[12px_16px] font-extrabold text-[#fff] tracking-[0.2px]">Elite Performance</td>
                <td className="p-[12px_16px]">Trần Hoàng</td>
                <td className="p-[12px_16px] text-center font-medium">12</td>
                <td className="p-[12px_16px] font-medium text-[var(--text2)]">BIOKAMA, FABICO</td>
                <td className="p-[12px_16px] text-right font-bold text-[#0fa86d]">1.240M</td>
                <td className="p-[12px_16px]"><Badge type="G">Hoạt động</Badge></td>
                <td className="p-[12px_16px] text-right">
                  <button className="bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] text-[10px] p-[4px_10px] rounded-[4px] border border-[rgba(255,255,255,0.08)] transition-all">Sửa</button>
                </td>
              </tr>
              {/* Row 2 */}
              <tr className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.015)] transition-colors">
                <td className="p-[12px_16px] font-bold text-[#3d8ef0]">TEAM-B</td>
                <td className="p-[12px_16px] font-extrabold text-[#fff] tracking-[0.2px]">Growth Hackers</td>
                <td className="p-[12px_16px]">Nguyễn Lan</td>
                <td className="p-[12px_16px] text-center font-medium">8</td>
                <td className="p-[12px_16px] font-medium text-[var(--text2)]">MASSHU, YASU</td>
                <td className="p-[12px_16px] text-right font-bold text-[#0fa86d]">860M</td>
                <td className="p-[12px_16px]"><Badge type="G">Hoạt động</Badge></td>
                <td className="p-[12px_16px] text-right">
                  <button className="bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] text-[10px] p-[4px_10px] rounded-[4px] border border-[rgba(255,255,255,0.08)] transition-all">Sửa</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
};
