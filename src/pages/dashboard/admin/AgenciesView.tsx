import React from 'react';
import { SectionCard, Badge } from '../../../components/crm-dashboard/atoms/SharedAtoms';

export const AgenciesView: React.FC = () => {
  return (
    <div className="dash-fade-up">
      <SectionCard 
        title="🏢 Module 5 — Quản lý Agency" 
        actions={<button className="bg-[#3d8ef0] hover:bg-[#2e7dd1] text-white py-[6px] px-[13px] rounded-[6px] text-[11px] font-bold transition-all shadow-[0_4px_12px_rgba(61,142,240,0.25)]">+ Thêm agency</button>}
        bodyPadding={false}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] text-[9px] font-bold tracking-[1px] uppercase text-[var(--text3)] text-left">
                <th className="p-[12px_16px]">MÃ</th>
                <th className="p-[12px_16px]">TÊN AGENCY</th>
                <th className="p-[12px_16px]">LIÊN HỆ</th>
                <th className="p-[12px_16px]">TELEGRAM</th>
                <th className="p-[12px_16px]">TK CUNG CẤP</th>
                <th className="p-[12px_16px]">DỰ ÁN</th>
                <th className="p-[12px_16px] text-right">TỔNG ĐÃ NẠP</th>
                <th className="p-[12px_16px] text-right">CÔNG NỢ</th>
                <th className="p-[12px_16px]">TRẠNG THÁI</th>
              </tr>
            </thead>
            <tbody className="text-[11.5px] text-[var(--text2)]">
              {/* Row 1 */}
              <tr className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.015)] transition-colors">
                <td className="p-[12px_16px] font-bold text-[#3d8ef0]">AG-01</td>
                <td className="p-[12px_16px] font-extrabold text-[#fff] tracking-[0.2px]">Media One</td>
                <td className="p-[12px_16px]">Nguyễn Hùng</td>
                <td className="p-[12px_16px] text-[#3d8ef0] font-medium">@mediaone_vn</td>
                <td className="p-[12px_16px]">
                  <span className="p-[2.5px_8px] bg-[rgba(61,142,240,0.12)] text-[#3d8ef0] rounded-[4px] text-[9.5px] font-bold border border-[rgba(61,142,240,0.2)]">FB VNĐ</span>
                </td>
                <td className="p-[12px_16px]">BK, FB</td>
                <td className="p-[12px_16px] text-right text-[var(--G)] font-extrabold">450M</td>
                <td className="p-[12px_16px] text-right font-medium">0</td>
                <td className="p-[12px_16px]"><Badge type="G">Active</Badge></td>
              </tr>
              {/* Row 2 */}
              <tr className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.015)] transition-colors">
                <td className="p-[12px_16px] font-bold text-[#3d8ef0]">AG-02</td>
                <td className="p-[12px_16px] font-extrabold text-[#fff] tracking-[0.2px]">AdsViet</td>
                <td className="p-[12px_16px]">Lê Thanh</td>
                <td className="p-[12px_16px] text-[#3d8ef0] font-medium">@adsviet</td>
                <td className="p-[12px_16px]">
                  <span className="p-[2.5px_8px] bg-[rgba(61,142,240,0.12)] text-[#3d8ef0] rounded-[4px] text-[9.5px] font-bold border border-[rgba(61,142,240,0.2)]">FB VNĐ</span>
                </td>
                <td className="p-[12px_16px]">BK, MS</td>
                <td className="p-[12px_16px] text-right font-extrabold">280M</td>
                <td className="p-[12px_16px] text-right font-medium">0</td>
                <td className="p-[12px_16px]"><Badge type="G">Active</Badge></td>
              </tr>
              {/* Row 3 */}
              <tr className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.015)] transition-colors">
                <td className="p-[12px_16px] font-bold text-[#3d8ef0]">AG-03</td>
                <td className="p-[12px_16px] font-extrabold text-[#fff] tracking-[0.2px]">DigiMedia</td>
                <td className="p-[12px_16px]">Phạm Loan</td>
                <td className="p-[12px_16px] text-[#3d8ef0] font-medium">@digimedia</td>
                <td className="p-[12px_16px]">
                  <span className="p-[2.5px_8px] bg-[rgba(61,142,240,0.12)] text-[#3d8ef0] rounded-[4px] text-[9.5px] font-bold border border-[rgba(61,142,240,0.2)]">FB USD</span>
                </td>
                <td className="p-[12px_16px]">YS</td>
                <td className="p-[12px_16px] text-right font-extrabold">190M</td>
                <td className="p-[12px_16px] text-right text-[var(--Y)] font-bold">20M</td>
                <td className="p-[12px_16px]"><Badge type="Y">Theo dõi</Badge></td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
};
