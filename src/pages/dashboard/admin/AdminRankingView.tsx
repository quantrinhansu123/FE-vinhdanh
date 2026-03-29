import React from 'react';
import { SectionCard, RankItem, ProgressRow, Badge } from '../../../components/crm-dashboard/atoms/SharedAtoms';

export const AdminRankingView: React.FC = () => {
  return (
    <div className="dash-fade-up">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-[14px]">
        <SectionCard title="🏆 Top Marketing hiệu quả cao" badge={{ text: 'Tháng 03', type: 'G' }}>
          <div className="flex flex-col">
            <RankItem 
              rank="01" 
              avatar="NL" 
              avatarBg="linear-gradient(135deg, #f59e0b, #ef4444)" 
              name="Nguyễn Thị Lan" 
              team="Team A · BIOKAMA · 31 ngày" 
              value="342M" 
              badgeText="15.2%" 
              badgeType="G" 
              rankColor="var(--gold)" 
              valueColor="var(--G)" 
            />
            <RankItem 
              rank="02" 
              avatar="TM" 
              avatarBg="linear-gradient(135deg, #3b82f6, #6366f1)" 
              name="Trần Văn Minh" 
              team="Team B · BIOKAMA · 29 ngày" 
              value="298M" 
              badgeText="20.5%" 
              badgeType="Y" 
              valueColor="var(--G)" 
            />
            <RankItem 
              rank="03" 
              avatar="LH" 
              avatarBg="linear-gradient(135deg, #10b981, #06b6d4)" 
              name="Lê Thị Hoa" 
              team="Team A · FABICO · 31 ngày" 
              value="215M" 
              badgeText="22.3%" 
              badgeType="G" 
            />
          </div>
        </SectionCard>

        <SectionCard title="🔥 Marketing đốt tiền — Cần xử lý" badge={{ text: 'Cảnh báo', type: 'R' }}>
          <div className="flex flex-col mb-[10px]">
            <RankItem 
              rank="!" 
              avatar="MC" 
              avatarBg="linear-gradient(135deg, #ef4444, #dc2626)" 
              name="MKT C" 
              team="Burn: 84 · MASSHU · Ads/DT 68%" 
              value="68%" 
              badgeText="🔴 Nguy" 
              badgeType="R" 
              rankColor="var(--R)" 
              nameColor="var(--R)" 
              valueColor="var(--R)" 
            />
            <RankItem 
              rank="!" 
              avatar="MA" 
              avatarBg="linear-gradient(135deg, #f97316, #dc2626)" 
              name="MKT A" 
              team="Burn: 78 · BIOKAMA · Ads/DT 58%" 
              value="58%" 
              badgeText="🔴 Nguy" 
              badgeType="R" 
              rankColor="var(--R)" 
              nameColor="var(--R)" 
              valueColor="var(--R)" 
            />
          </div>
          <div className="pt-[10px] border-t border-[var(--border)]">
            <div className="text-[9.5px] font-extrabold text-[var(--text3)] uppercase tracking-[0.8px] mb-[8px]">Tiêu chí xếp hạng</div>
            <ProgressRow label="Doanh số cao" valueText="35%" percent={35} color="var(--G)" subLabel="" />
            <ProgressRow label="Ads/DT thấp" valueText="30%" percent={30} color="var(--accent)" subLabel="" />
            <ProgressRow label="Tỷ lệ chốt" valueText="25%" percent={25} color="var(--P)" subLabel="" />
          </div>
        </SectionCard>
      </div>
    </div>
  );
};
