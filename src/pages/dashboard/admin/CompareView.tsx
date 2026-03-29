import React from 'react';
import { SectionCard } from '../../../components/crm-dashboard/atoms/SharedAtoms';

export const CompareView: React.FC = () => {
  return (
    <div className="dash-fade-up">
      <SectionCard title="📈 So sánh tuần / tháng">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[10px]">
          <div className="bg-[var(--bg3)] rounded-[8px] border border-[var(--border)] p-[12px_14px]">
            <div className="text-[9.5px] font-extrabold tracking-[0.8px] uppercase text-[var(--text3)] mb-[8px]">Tuần này</div>
            <div className="font-[var(--mono)] text-[18px] font-extrabold text-[var(--G)]">712M</div>
            <div className="text-[10.5px] font-bold text-[var(--G)] mt-[6px]">▲ +8.4% tuần trước</div>
          </div>
          <div className="bg-[var(--bg3)] rounded-[8px] border border-[var(--border)] p-[12px_14px]">
            <div className="text-[9.5px] font-extrabold tracking-[0.8px] uppercase text-[var(--text3)] mb-[8px]">Tuần trước</div>
            <div className="font-[var(--mono)] text-[18px] font-extrabold text-[var(--text)]">657M</div>
            <div className="text-[10.5px] font-bold text-[var(--text3)] mt-[6px]">Baseline</div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
};
