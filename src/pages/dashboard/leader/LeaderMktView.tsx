import React from 'react';
import { SectionCard, Badge } from '../../../components/crm-dashboard/atoms/SharedAtoms';

export const LeaderMktView: React.FC = () => {
  return (
    <div className="dash-fade-up">
      <SectionCard 
        title="👥 Quản lý Marketing — Team A" 
        subtitle="5 nhân sự hoạt động · KPI trung bình 68.5%"
        actions={<button className="bg-[#3d8ef0] hover:bg-[#2e7dd1] text-white py-[6px] px-[13px] rounded-[6px] text-[11px] font-bold transition-all shadow-[0_4px_12px_rgba(61,142,240,0.25)]">+ Thêm Marketing</button>}
        bodyPadding={false}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] text-[9px] font-bold tracking-[1px] uppercase text-[var(--text3)] text-left">
                <th className="p-[12px_16px]">MÃ NS</th>
                <th className="p-[12px_16px]">HỌ TÊN</th>
                <th className="p-[12px_16px]">NGÀY BẮT ĐẦU</th>
                <th className="p-[12px_16px]">DỰ ÁN</th>
                <th className="p-[12px_16px] text-center">TK ADS</th>
                <th className="p-[12px_16px] text-right">KPI THÁNG</th>
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
                <td className="p-[12px_16px] font-medium text-[var(--text2)]">BIOKAMA</td>
                <td className="p-[12px_16px] text-center">
                  <span className="p-[2.5px_8px] bg-[rgba(16,185,129,0.12)] text-[var(--G)] rounded-[4px] text-[9.5px] font-bold border border-[rgba(16,185,129,0.2)]">2 tài khoản</span>
                </td>
                <td className="p-[12px_16px] text-right font-bold text-[var(--G)]">85.5%</td>
                <td className="p-[12px_16px]"><Badge type="G">Hoạt động</Badge></td>
                <td className="p-[12px_16px] text-right">
                  <button className="bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] text-[10px] p-[4px_10px] rounded-[4px] border border-[rgba(255,255,255,0.08)] transition-all">Sửa</button>
                </td>
              </tr>
              {/* Row 2 */}
              <tr className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.015)] transition-colors">
                <td className="p-[12px_16px] font-bold text-[#3d8ef0]">MK-003</td>
                <td className="p-[12px_16px] font-extrabold text-[#fff] tracking-[0.2px]">Trần Văn Minh</td>
                <td className="p-[12px_16px]">15/01/2025</td>
                <td className="p-[12px_16px] font-medium text-[var(--text2)]">BIOKAMA</td>
                <td className="p-[12px_16px] text-center">
                  <span className="p-[2.5px_8px] bg-[rgba(16,185,129,0.12)] text-[var(--G)] rounded-[4px] text-[9.5px] font-bold border border-[rgba(16,185,129,0.2)]">1 tài khoản</span>
                </td>
                <td className="p-[12px_16px] text-right font-bold text-[var(--G)]">85.1%</td>
                <td className="p-[12px_16px]"><Badge type="G">Hoạt động</Badge></td>
                <td className="p-[12px_16px] text-right">
                  <button className="bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] text-[10px] p-[4px_10px] rounded-[4px] border border-[rgba(255,255,255,0.08)] transition-all">Sửa</button>
                </td>
              </tr>
              {/* Row 3 */}
              <tr className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.015)] transition-colors">
                <td className="p-[12px_16px] font-bold text-[#3d8ef0]">MK-004</td>
                <td className="p-[12px_16px] font-extrabold text-[#fff] tracking-[0.2px]">Lê Thị Hoa</td>
                <td className="p-[12px_16px]">01/02/2025</td>
                <td className="p-[12px_16px] font-medium text-[var(--text2)]">FABICO</td>
                <td className="p-[12px_16px] text-center">
                  <span className="p-[2.5px_8px] bg-[rgba(16,185,129,0.12)] text-[var(--G)] rounded-[4px] text-[9.5px] font-bold border border-[rgba(16,185,129,0.2)]">1 tài khoản</span>
                </td>
                <td className="p-[12px_16px] text-right font-bold text-[var(--Y)]">71.7%</td>
                <td className="p-[12px_16px]"><Badge type="Y">Monitor</Badge></td>
                <td className="p-[12px_16px] text-right">
                  <button className="bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] text-[10px] p-[4px_10px] rounded-[4px] border border-[rgba(255,255,255,0.08)] transition-all">Sửa</button>
                </td>
              </tr>
              {/* Row 4 */}
              <tr className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(224,61,61,0.02)] transition-colors">
                <td className="p-[12px_16px] font-bold text-[#3d8ef0]">MK-006</td>
                <td className="p-[12px_16px] font-extrabold text-[var(--Y)] tracking-[0.2px]">Phạm Quốc Hùng</td>
                <td className="p-[12px_16px]">01/03/2025</td>
                <td className="p-[12px_16px] font-medium text-[var(--text2)]">BIOKAMA</td>
                <td className="p-[12px_16px] text-center">
                  <span className="p-[2.5px_8px] bg-[rgba(224,61,61,0.12)] text-[var(--R)] rounded-[4px] text-[9.5px] font-bold border border-[rgba(224,61,61,0.2)]">1 tài khoản</span>
                </td>
                <td className="p-[12px_16px] text-right font-bold text-[var(--R)]">30.4%</td>
                <td className="p-[12px_16px]"><Badge type="R">Cảnh báo</Badge></td>
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
