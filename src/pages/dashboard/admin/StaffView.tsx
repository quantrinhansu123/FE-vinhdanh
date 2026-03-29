import React from 'react';
import { SectionCard, Badge } from '../../../components/crm-dashboard/atoms/SharedAtoms';

export const StaffView: React.FC = () => {
  return (
    <div className="dash-fade-up">
      <SectionCard 
        title="👤 Module 3 — Quản lý Nhân sự Marketing" 
        actions={<button className="bg-[#3d8ef0] hover:bg-[#2e7dd1] text-white py-[6px] px-[13px] rounded-[6px] text-[11px] font-bold transition-all shadow-[0_4px_12px_rgba(61,142,240,0.25)]">+ Thêm nhân sự</button>}
        bodyPadding={false}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] text-[9px] font-bold tracking-[1px] uppercase text-[var(--text3)] text-left">
                <th className="p-[12px_16px]">MÃ NS</th>
                <th className="p-[12px_16px]">HỌ TÊN</th>
                <th className="p-[12px_16px]">NGÀY BẮT ĐẦU</th>
                <th className="p-[12px_16px] text-right">NGÀY LÀM VIỆC</th>
                <th className="p-[12px_16px]">TEAM / DỰ ÁN</th>
                <th className="p-[12px_16px]">LEADER</th>
                <th className="p-[12px_16px]">FANPAGE</th>
                <th className="p-[12px_16px]">TRẠNG THÁI</th>
                <th className="p-[12px_16px]"></th>
              </tr>
            </thead>
            <tbody className="text-[11.5px] text-[var(--text2)]">
              {/* Row 1 */}
              <tr className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.015)] transition-colors">
                <td className="p-[12px_16px] font-bold text-[#3d8ef0]">MK-001</td>
                <td className="p-[12px_16px] font-extrabold text-[#fff] tracking-[0.2px]">Nguyễn Thị Lan</td>
                <td className="p-[12px_16px]">01/01/2025</td>
                <td className="p-[12px_16px] text-right font-medium">83</td>
                <td className="p-[12px_16px] font-medium text-[var(--text2)]">Team A · BIOKAMA</td>
                <td className="p-[12px_16px]">Trần Hoàng</td>
                <td className="p-[12px_16px]">
                  <span className="p-[2.5px_8px] bg-[rgba(61,142,240,0.12)] text-[#3d8ef0] rounded-[4px] text-[9.5px] font-bold border border-[rgba(61,142,240,0.2)]">2 fanpage</span>
                </td>
                <td className="p-[12px_16px]"><Badge type="G">Đang làm</Badge></td>
                <td className="p-[12px_16px] text-right">
                  <button className="bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] text-[10px] p-[4px_10px] rounded-[4px] border border-[rgba(255,255,255,0.08)] transition-all">Sửa</button>
                </td>
              </tr>
              {/* Row 2 */}
              <tr className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.015)] transition-colors">
                <td className="p-[12px_16px] font-bold text-[#3d8ef0]">MK-002</td>
                <td className="p-[12px_16px] font-extrabold text-[#fff] tracking-[0.2px]">Trần Văn Minh</td>
                <td className="p-[12px_16px]">15/01/2025</td>
                <td className="p-[12px_16px] text-right font-medium">69</td>
                <td className="p-[12px_16px] font-medium text-[var(--text2)]">Team B · BIOKAMA</td>
                <td className="p-[12px_16px]">Trần Hoàng</td>
                <td className="p-[12px_16px]">
                  <span className="p-[2.5px_8px] bg-[rgba(61,142,240,0.12)] text-[#3d8ef0] rounded-[4px] text-[9.5px] font-bold border border-[rgba(61,142,240,0.2)]">1 fanpage</span>
                </td>
                <td className="p-[12px_16px]"><Badge type="G">Đang làm</Badge></td>
                <td className="p-[12px_16px] text-right">
                  <button className="bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] text-[10px] p-[4px_10px] rounded-[4px] border border-[rgba(255,255,255,0.08)] transition-all">Sửa</button>
                </td>
              </tr>
              {/* Row 3 */}
              <tr className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.015)] transition-colors">
                <td className="p-[12px_16px] font-bold text-[#3d8ef0]">MK-007</td>
                <td className="p-[12px_16px] font-extrabold text-[#fff] tracking-[0.2px]">MKT A</td>
                <td className="p-[12px_16px]">01/03/2025</td>
                <td className="p-[12px_16px] text-right font-medium">24</td>
                <td className="p-[12px_16px] font-medium text-[var(--text2)]">Team C · BIOKAMA</td>
                <td className="p-[12px_16px]">Phạm Tùng</td>
                <td className="p-[12px_16px]">
                  <span className="p-[2.5px_8px] bg-[rgba(61,142,240,0.12)] text-[#3d8ef0] rounded-[4px] text-[9.5px] font-bold border border-[rgba(61,142,240,0.2)]">2 fanpage</span>
                </td>
                <td className="p-[12px_16px]">
                  <span className="inline-flex items-center gap-[4px] p-[2.5px_8px] bg-[rgba(224,61,61,0.12)] text-[var(--R)] rounded-[4px] text-[9.5px] font-extrabold border border-[rgba(224,61,61,0.2)]">
                    ⚠ Đốt tiền
                  </span>
                </td>
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
