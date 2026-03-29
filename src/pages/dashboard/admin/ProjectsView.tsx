import React from 'react';
import { SectionCard, Badge } from '../../../components/crm-dashboard/atoms/SharedAtoms';

export const ProjectsView: React.FC = () => {
  return (
    <div className="dash-fade-up">
      <SectionCard 
        title="📁 Module 1 — Quản lý Dự án" 
        actions={<button className="bg-[#3d8ef0] hover:bg-[#2e7dd1] text-white py-[6px] px-[13px] rounded-[6px] text-[11px] font-bold transition-all shadow-[0_4px_12px_rgba(61,142,240,0.25)]">+ Thêm dự án</button>}
        bodyPadding={false}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] text-[9px] font-bold tracking-[1px] uppercase text-[var(--text3)] text-left">
                <th className="p-[12px_16px]">MÃ</th>
                <th className="p-[12px_16px]">TÊN DỰ ÁN</th>
                <th className="p-[12px_16px]">THỊ TRƯỜNG</th>
                <th className="p-[12px_16px]">LEADER</th>
                <th className="p-[12px_16px] text-center">MKT</th>
                <th className="p-[12px_16px] text-right">DT THÁNG</th>
                <th className="p-[12px_16px]">TRẠNG THÁI</th>
                <th className="p-[12px_16px]"></th>
              </tr>
            </thead>
            <tbody className="text-[11.5px] text-[var(--text2)]">
              {/* Row 1 */}
              <tr className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.015)] transition-colors">
                <td className="p-[12px_16px] font-bold text-[#3d8ef0]">BK</td>
                <td className="p-[12px_16px] font-extrabold text-[#fff] tracking-[0.2px]">BIOKAMA</td>
                <td className="p-[12px_16px]">Việt Nam</td>
                <td className="p-[12px_16px]">Trần Hoàng</td>
                <td className="p-[12px_16px] text-center">8</td>
                <td className="p-[12px_16px] text-right font-bold text-[#0fa86d]">1.485M</td>
                <td className="p-[12px_16px]"><Badge type="G">Active</Badge></td>
                <td className="p-[12px_16px] text-right">
                  <button className="bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] text-[10px] p-[4px_10px] rounded-[4px] border border-[rgba(255,255,255,0.08)] transition-all">Sửa</button>
                </td>
              </tr>
              {/* Row 2 */}
              <tr className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.015)] transition-colors">
                <td className="p-[12px_16px] font-bold text-[#3d8ef0]">FB</td>
                <td className="p-[12px_16px] font-extrabold text-[#fff] tracking-[0.2px]">FABICO</td>
                <td className="p-[12px_16px]">Việt Nam</td>
                <td className="p-[12px_16px]">Nguyễn Lan</td>
                <td className="p-[12px_16px] text-center">3</td>
                <td className="p-[12px_16px] text-right font-medium text-[var(--text2)]">580M</td>
                <td className="p-[12px_16px]"><Badge type="G">Active</Badge></td>
                <td className="p-[12px_16px] text-right">
                  <button className="bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] text-[10px] p-[4px_10px] rounded-[4px] border border-[rgba(255,255,255,0.08)] transition-all">Sửa</button>
                </td>
              </tr>
              {/* Row 3 */}
              <tr className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.015)] transition-colors">
                <td className="p-[12px_16px] font-bold text-[#3d8ef0]">MS</td>
                <td className="p-[12px_16px] font-extrabold text-[#fff] tracking-[0.2px]">MASSHU</td>
                <td className="p-[12px_16px]">Việt Nam</td>
                <td className="p-[12px_16px]">Phạm Tùng</td>
                <td className="p-[12px_16px] text-center">2</td>
                <td className="p-[12px_16px] text-right font-bold text-[#e8a020]">284M</td>
                <td className="p-[12px_16px]"><Badge type="Y">Review</Badge></td>
                <td className="p-[12px_16px] text-right">
                  <button className="bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] text-[10px] p-[4px_10px] rounded-[4px] border border-[rgba(255,255,255,0.08)] transition-all">Sửa</button>
                </td>
              </tr>
              {/* Row 4 */}
              <tr className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.015)] transition-colors last:border-0">
                <td className="p-[12px_16px] font-bold text-[#3d8ef0]">YS</td>
                <td className="p-[12px_16px] font-extrabold text-[#fff] tracking-[0.2px]">YASU</td>
                <td className="p-[12px_16px]">Việt Nam</td>
                <td className="p-[12px_16px]">Lê Minh</td>
                <td className="p-[12px_16px] text-center">1</td>
                <td className="p-[12px_16px] text-right font-medium text-[var(--text2)]">124M</td>
                <td className="p-[12px_16px]"><Badge type="G">Active</Badge></td>
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
