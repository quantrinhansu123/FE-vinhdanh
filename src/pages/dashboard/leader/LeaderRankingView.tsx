import React from 'react';
import { SectionCard, RankItem, ProgressRow } from '../../../components/crm-dashboard/atoms/SharedAtoms';

export const LeaderRankingView: React.FC = () => {
  return (
    <div className="dash-fade-up">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[14px]">
        {/* Left Column: Top Performers */}
        <SectionCard title="🏆 Xếp hạng Marketing — Team A" badge={{ text: 'Tháng 03', type: 'G' }}>
          <div className="flex flex-col">
            <RankItem 
              rank="01" 
              avatar="NL" 
              avatarBg="linear-gradient(135deg, #f59e0b, #ef4444)" 
              name="Nguyễn Thị Lan" 
              team="TK-001,002 · BIOKAMA · KPI 85.5%" 
              value="342M" 
              badgeText="15.2% Ads" 
              badgeType="G" 
              rankColor="var(--gold)" 
              valueColor="var(--G)" 
            />
            <RankItem 
              rank="02" 
              avatar="TM" 
              avatarBg="linear-gradient(135deg, #3b82f6, #6366f1)" 
              name="Trần Văn Minh" 
              team="TK-003 · BIOKAMA · KPI 85.1%" 
              value="298M" 
              badgeText="20.5% Ads" 
              badgeType="G" 
              valueColor="var(--G)" 
            />
            <RankItem 
              rank="03" 
              avatar="LH" 
              avatarBg="linear-gradient(135deg, #10b981, #06b6d4)" 
              name="Lê Thị Hoa" 
              team="TK-004 · FABICO · KPI 71.7%" 
              value="215M" 
              badgeText="22.3% Ads" 
              badgeType="Y" 
            />
          </div>
        </SectionCard>

        {/* Right Column: Alerts & KPI Progress */}
        <div className="space-y-[14px]">
          <SectionCard title="🔥 Cảnh báo hiệu suất" badge={{ text: 'Critical', type: 'R' }}>
            <div className="flex flex-col mb-[10px]">
              <RankItem 
                rank="!" 
                avatar="PH" 
                avatarBg="linear-gradient(135deg, #ef4444, #dc2626)" 
                name="Phạm Quốc Hùng" 
                team="Burn: 52.6% · TK-006 · KPI 30.4%" 
                value="52.6%" 
                badgeText="🔴 High Risk" 
                badgeType="R" 
                rankColor="var(--R)" 
                nameColor="var(--Y)" 
                valueColor="var(--R)" 
              />
            </div>
            <div className="pt-[14px] border-t border-[var(--border)]">
              <div className="text-[10px] font-extrabold text-[var(--text3)] uppercase tracking-[1.5px] mb-[12px]">Cố vấn hành động</div>
              <div className="bg-[rgba(224,61,61,0.08)] border border-[rgba(224,61,61,0.15)] rounded-[8px] p-[10px] text-[10.5px] text-[var(--R)] font-medium leading-[1.6]">
                ⚠️ <strong>Phạm Quốc Hùng:</strong> Chi phí Ads hiện tại (40M) chiếm 52.6% doanh số. Cần tạm dừng chiến dịch TK-006 để tối ưu tệp đối tượng hoặc content mới ngay lập tức.
              </div>
            </div>
          </SectionCard>

          <SectionCard title="🎯 Tiêu chí xếp hạng Team">
            <div className="space-y-[12px]">
              <ProgressRow label="Doanh số (KPI)" valueText="40%" percent={40} color="var(--G)" subLabel="Trọng số cao nhất" />
              <ProgressRow label="Tỷ lệ Ads/DT (<20%)" valueText="30%" percent={30} color="var(--accent)" />
              <ProgressRow label="Tỷ lệ chốt Lead" valueText="20%" percent={20} color="var(--P)" />
              <ProgressRow label="Số lượng lead mới" valueText="10%" percent={10} color="var(--Y)" />
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
};
