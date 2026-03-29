import React from 'react';
import { KpiCard } from '../../../components/crm-dashboard/atoms/KpiCard';
import { SectionCard, Badge, BudgetCard } from '../../../components/crm-dashboard/atoms/SharedAtoms';

export const BudgetView: React.FC = () => {
  return (
    <div className="dash-fade-up">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-[10px] mb-[18px]">
        <KpiCard label="ĐÃ NẠP THÁNG NÀY" value="920.000.000" sub="VNĐ · 4 agency" barColor="#3d8ef0" valueSize="lg" />
        <KpiCard label="MKT KHAI BÁO CHI" value="680.000.000" sub="VNĐ · 16 accounts" barColor="#10b981" valueSize="lg" />
        <KpiCard label="ĐANG CHỜ DUYỆT" value="310.000.000" sub="VNĐ · 3 yêu cầu" barColor="#f59e0b" valueSize="lg" />
        <KpiCard label="CHÊNH LỆCH TỒN" value="240.000.000" sub="VNĐ · Chưa chi" barColor="#ef4444" valueSize="lg" />
      </div>

      <SectionCard 
        title="📋 Yêu cầu nạp ngân sách — Đang chờ duyệt" 
        badge={{ text: '3 yêu cầu', type: 'Y' }}
      >
        <div className="flex flex-col gap-[10px]">
          <BudgetCard 
            id="YC-031" 
            agency="Media One" 
            team="Team A" 
            project="BIOKAMA" 
            accounts="TK-001, TK-002, TK-003" 
            priority="Cao" 
            date="25/03 09:15" 
            amount="150.000.000đ" 
            isPending 
            onApprove={() => {}} 
            onReject={() => {}} 
            onDetail={() => {}} 
          />
          <BudgetCard 
            id="YC-030" 
            agency="AdsViet" 
            team="Team B" 
            project="FABICO" 
            accounts="TK-005, TK-006" 
            priority="TB" 
            date="24/03 16:40" 
            amount="80.000.000đ" 
            isPending
            onApprove={() => {}} 
            onReject={() => {}} 
            onDetail={() => {}} 
          />
          <BudgetCard 
            id="YC-029" 
            agency="DigiMedia" 
            team="Team C" 
            project="MASSHU" 
            accounts="TK-009" 
            priority="TB" 
            date="24/03 11:20" 
            amount="80.000.000đ" 
            isPending
            onApprove={() => {}} 
            onReject={() => {}} 
            onDetail={() => {}} 
          />
        </div>
      </SectionCard>

      <div className="mt-[20px]">
        <SectionCard title="✅ Lịch sử duyệt" bodyPadding={false}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] text-[9px] font-bold tracking-[1px] uppercase text-[var(--text3)] text-left">
                  <th className="p-[12px_16px]">MÃ YC</th>
                  <th className="p-[12px_16px]">AGENCY</th>
                  <th className="p-[12px_16px]">LEADER</th>
                  <th className="p-[12px_16px] text-right">SỐ TIỀN</th>
                  <th className="p-[12px_16px]">NGÀY DUYỆT</th>
                  <th className="p-[12px_16px]">NGƯỜI DUYỆT</th>
                  <th className="p-[12px_16px]">TT</th>
                </tr>
              </thead>
              <tbody className="text-[11.5px] text-[var(--text2)]">
                {/* Row 1 */}
                <tr className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.015)] transition-colors">
                  <td className="p-[12px_16px] font-bold text-[#3d8ef0]">YC-028</td>
                  <td className="p-[12px_16px]">Media One</td>
                  <td className="p-[12px_16px]">Trần Hoàng · BK</td>
                  <td className="p-[12px_16px] text-right font-medium text-[var(--text)]">120.000.000</td>
                  <td className="p-[12px_16px]">20/03/2025</td>
                  <td className="p-[12px_16px]">Admin</td>
                  <td className="p-[12px_16px]">
                    <span className="p-[2.5px_8px] bg-[rgba(16,185,129,0.12)] text-[#10b981] rounded-[4px] text-[9.5px] font-bold border border-[rgba(16,185,129,0.2)]">Đã duyệt</span>
                  </td>
                </tr>
                {/* Row 2 */}
                <tr className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.015)] transition-colors">
                  <td className="p-[12px_16px] font-bold text-[#3d8ef0]">YC-027</td>
                  <td className="p-[12px_16px]">AdsViet</td>
                  <td className="p-[12px_16px]">Nguyễn Lan · FB</td>
                  <td className="p-[12px_16px] text-right font-medium text-[var(--text)]">60.000.000</td>
                  <td className="p-[12px_16px]">18/03/2025</td>
                  <td className="p-[12px_16px]">Admin</td>
                  <td className="p-[12px_16px]">
                    <span className="p-[2.5px_8px] bg-[rgba(16,185,129,0.12)] text-[#10b981] rounded-[4px] text-[9.5px] font-bold border border-[rgba(16,185,129,0.2)]">Đã duyệt</span>
                  </td>
                </tr>
                {/* Row 3 */}
                <tr className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.015)] transition-colors">
                  <td className="p-[12px_16px] font-bold text-[#3d8ef0]">YC-026</td>
                  <td className="p-[12px_16px]">DigiMedia</td>
                  <td className="p-[12px_16px]">Phạm Tùng · MS</td>
                  <td className="p-[12px_16px] text-right font-medium text-[var(--text)]">90.000.000</td>
                  <td className="p-[12px_16px]">15/03/2025</td>
                  <td className="p-[12px_16px]">Admin</td>
                  <td className="p-[12px_16px]">
                    <span className="p-[2.5px_8px] bg-[rgba(224,61,61,0.12)] text-[#ef4444] rounded-[4px] text-[9.5px] font-bold border border-[rgba(224,61,61,0.2)]">Từ chối</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </div>
  );
};
