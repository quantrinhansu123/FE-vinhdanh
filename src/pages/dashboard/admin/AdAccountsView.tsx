import React from 'react';
import { SectionCard, Badge } from '../../../components/crm-dashboard/atoms/SharedAtoms';

export const AdAccountsView: React.FC = () => {
  return (
    <div className="dash-fade-up">
      <SectionCard 
        title="🎯 Module 4 — Quản lý Tài khoản Quảng cáo" 
        actions={<button className="bg-[#3d8ef0] hover:bg-[#2e7dd1] text-white py-[6px] px-[13px] rounded-[6px] text-[11px] font-bold transition-all shadow-[0_4px_12px_rgba(61,142,240,0.25)]">+ Thêm tài khoản</button>}
        bodyPadding={false}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] text-[9px] font-bold tracking-[1px] uppercase text-[var(--text3)] text-left">
                <th className="p-[12px_16px]">MÃ TK</th>
                <th className="p-[12px_16px]">TÊN TK ADS</th>
                <th className="p-[12px_16px]">MARKETING</th>
                <th className="p-[12px_16px]">TEAM/DỰ ÁN</th>
                <th className="p-[12px_16px]">AGENCY</th>
                <th className="p-[12px_16px]">LOẠI TIỀN</th>
                <th className="p-[12px_16px] text-right">HẠN MỨC</th>
                <th className="p-[12px_16px]">FANPAGE</th>
                <th className="p-[12px_16px]">NGÀY BĐ</th>
                <th className="p-[12px_16px]">TRẠNG THÁI</th>
              </tr>
            </thead>
            <tbody className="text-[11.5px] text-[var(--text2)]">
              {/* Row 1 */}
              <tr className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.015)] transition-colors">
                <td className="p-[12px_16px] font-bold text-[#3d8ef0]">TK-001</td>
                <td className="p-[12px_16px] font-extrabold text-[#fff] tracking-[0.2px]">FB Ads BK Main</td>
                <td className="p-[12px_16px]">NTL (MK-001)</td>
                <td className="p-[12px_16px]">Team A · BK</td>
                <td className="p-[12px_16px]">Media One</td>
                <td className="p-[12px_16px]">
                  <span className="p-[2.5px_8px] bg-[rgba(61,142,240,0.12)] text-[#3d8ef0] rounded-[4px] text-[9.5px] font-bold border border-[rgba(61,142,240,0.2)]">VNĐ</span>
                </td>
                <td className="p-[12px_16px] text-right font-bold text-[var(--text)]">200M</td>
                <td className="p-[12px_16px] text-[var(--text3)]">BIOKAMA Official</td>
                <td className="p-[12px_16px]">01/01/25</td>
                <td className="p-[12px_16px]"><Badge type="G">Active</Badge></td>
              </tr>
              {/* Row 2 */}
              <tr className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.015)] transition-colors">
                <td className="p-[12px_16px] font-bold text-[#3d8ef0]">TK-002</td>
                <td className="p-[12px_16px] font-extrabold text-[#fff] tracking-[0.2px]">FB Ads BK Backup</td>
                <td className="p-[12px_16px]">NTL (MK-001)</td>
                <td className="p-[12px_16px]">Team A · BK</td>
                <td className="p-[12px_16px]">Media One</td>
                <td className="p-[12px_16px]">
                  <span className="p-[2.5px_8px] bg-[rgba(61,142,240,0.12)] text-[#3d8ef0] rounded-[4px] text-[9.5px] font-bold border border-[rgba(61,142,240,0.2)]">VNĐ</span>
                </td>
                <td className="p-[12px_16px] text-right font-bold text-[var(--text)]">150M</td>
                <td className="p-[12px_16px] text-[var(--text3)]">BK Nông Nghiệp</td>
                <td className="p-[12px_16px]">01/01/25</td>
                <td className="p-[12px_16px]"><Badge type="G">Active</Badge></td>
              </tr>
              {/* Row 3 */}
              <tr className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.015)] transition-colors">
                <td className="p-[12px_16px] font-bold text-[#3d8ef0]">TK-003</td>
                <td className="p-[12px_16px] font-extrabold text-[#fff] tracking-[0.2px]">FB Ads BK Scale</td>
                <td className="p-[12px_16px]">TVM (MK-002)</td>
                <td className="p-[12px_16px]">Team B · BK</td>
                <td className="p-[12px_16px]">AdsViet</td>
                <td className="p-[12px_16px]">
                  <span className="p-[2.5px_8px] bg-[rgba(61,142,240,0.12)] text-[#3d8ef0] rounded-[4px] text-[9.5px] font-bold border border-[rgba(61,142,240,0.2)]">VNĐ</span>
                </td>
                <td className="p-[12px_16px] text-right font-bold text-[var(--text)]">180M</td>
                <td className="p-[12px_16px] text-[var(--text3)]">BK Scale</td>
                <td className="p-[12px_16px]">15/01/25</td>
                <td className="p-[12px_16px]"><Badge type="G">Active</Badge></td>
              </tr>
              {/* Row 4 - Alert */}
              <tr className="border-b border-[rgba(224,61,61,0.1)] bg-[rgba(224,61,61,0.03)] hover:bg-[rgba(224,61,61,0.05)] transition-colors">
                <td className="p-[12px_16px] font-bold text-[var(--R)]">TK-004</td>
                <td className="p-[12px_16px] font-extrabold text-[#fbbf24] tracking-[0.2px]">FB Ads BK Test</td>
                <td className="p-[12px_16px] text-[var(--text3)]">—</td>
                <td className="p-[12px_16px] text-[var(--text3)]">Team C · BK</td>
                <td className="p-[12px_16px] text-[var(--R)] font-bold">⚠ Chưa gắn</td>
                <td className="p-[12px_16px]">
                  <span className="p-[2.5px_8px] bg-[rgba(61,142,240,0.12)] text-[#3d8ef0] rounded-[4px] text-[9.5px] font-bold border border-[rgba(61,142,240,0.2)]">VNĐ</span>
                </td>
                <td className="p-[12px_16px] text-right text-[var(--text3)]">—</td>
                <td className="p-[12px_16px] text-[var(--text3)]">—</td>
                <td className="p-[12px_16px]">20/03/25</td>
                <td className="p-[12px_16px]">
                  <span className="inline-flex items-center gap-[4px] p-[2.5px_8px] bg-[rgba(224,61,61,0.12)] text-[var(--R)] rounded-[4px] text-[9.5px] font-extrabold border border-[rgba(224,61,61,0.2)]">
                    Thiếu thiết lập
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
};
