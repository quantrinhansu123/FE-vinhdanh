import React from 'react';
import { BillCard, SectionCard } from '../../../components/crm-dashboard/atoms/SharedAtoms';

export const MktBillView: React.FC = () => {
  return (
    <div className="dash-fade-up">
      <div className="flex flex-wrap gap-[16px] items-start">
        <BillCard 
          name="Nguyễn Thị Lan" 
          team="Team A · BIOKAMA" 
          date="25/03/2025" 
          workDay={83} 
          lastUpdate="15:42" 
          stats={{
            revenue: '12.400.000',
            adsCost: '1.880.000',
            mess: 284,
            lead: 42,
            orders: 11
          }} 
          performance={{
            adsRatio: '15.2%',
            closeRate: '26.2%',
            leadRate: '25.0%',
            aov: '1.127.272',
            cpo: '170.909',
            cpl: '44.762',
            cpa: '6.620'
          }} 
          indicator={{ 
            type: 'G', 
            text: 'Ads/DT = 15.2% — An toàn (<39%)' 
          }} 
        />

        <div className="flex-1 min-w-[280px] flex flex-col gap-[14px]">
          <SectionCard title="📐 Công thức chuẩn hóa">
            <div className="flex flex-col gap-[8px]">
              <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-[8px] p-[10px_13px] flex justify-between items-center h-[40px]">
                <div className="text-[11px] text-[var(--text2)] font-medium">% Ads / Doanh số</div>
                <div className="font-[var(--mono)] text-[10.5px] text-[var(--accent)] font-bold">Chi phí Ads ÷ Doanh số</div>
              </div>
              <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-[8px] p-[10px_13px] flex justify-between items-center h-[40px]">
                <div className="text-[11px] text-[var(--text2)] font-medium">Tỷ lệ xin số</div>
                <div className="font-[var(--mono)] text-[10.5px] text-[var(--accent)] font-bold">Tổng Lead ÷ Tổng Mess</div>
              </div>
              <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-[8px] p-[10px_13px] flex justify-between items-center h-[40px]">
                <div className="text-[11px] text-[var(--text2)] font-medium">AOV</div>
                <div className="font-[var(--mono)] text-[10.5px] text-[var(--accent)] font-bold">Doanh số ÷ Tổng đơn chốt</div>
              </div>
              <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-[8px] p-[10px_13px] flex justify-between items-center h-[40px]">
                <div className="text-[11px] text-[var(--text2)] font-medium">CPO</div>
                <div className="font-[var(--mono)] text-[10.5px] text-[var(--accent)] font-bold">Chi phí Ads ÷ Tổng đơn chốt</div>
              </div>
              <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-[8px] p-[10px_13px] flex justify-between items-center h-[40px]">
                <div className="text-[11px] text-[var(--text2)] font-medium">CPL</div>
                <div className="font-[var(--mono)] text-[10.5px] text-[var(--accent)] font-bold">Chi phí Ads ÷ Tổng lead</div>
              </div>
              <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-[8px] p-[10px_13px] flex justify-between items-center h-[40px]">
                <div className="text-[11px] text-[var(--text2)] font-medium">CPA</div>
                <div className="font-[var(--mono)] text-[10.5px] text-[var(--accent)] font-bold">Chi phí Ads ÷ Tổng mess</div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="📊 So sánh hôm nay vs hôm qua" bodyPadding={true}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[14px]">
              <div className="bg-[var(--bg4)] rounded-[12px] border border-[var(--border)] p-[16px_18px] transition-all hover:bg-[rgba(255,255,255,0.01)] relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-[3px] h-full bg-[var(--G)] opacity-60"></div>
                <div className="text-[10px] font-extrabold tracking-[1px] uppercase text-[var(--text3)] mb-[10px]">Hôm nay</div>
                <div className="flex items-baseline gap-[6px]">
                  <div className="font-[var(--mono)] text-[22px] font-black text-[var(--G)]">12.4M đ</div>
                </div>
                <div className="text-[10px] text-[var(--text3)] mt-[4px] font-medium">Ads 15.2% · CPO 171k</div>
                <div className="text-[11px] font-black text-[var(--G)] mt-[8px] flex items-center gap-[4px]">
                  <span>▲</span> +18% doanh số
                </div>
              </div>

              <div className="bg-[var(--bg4)] rounded-[12px] border border-[var(--border)] p-[16px_18px] transition-all hover:bg-[rgba(255,255,255,0.01)] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-[3px] h-full bg-[var(--text3)] opacity-30"></div>
                <div className="text-[10px] font-extrabold tracking-[1px] uppercase text-[var(--text3)] mb-[10px]">Hôm qua</div>
                <div className="font-[var(--mono)] text-[22px] font-black text-[var(--text2)]">10.5M đ</div>
                <div className="text-[10px] text-[var(--text3)] mt-[4px] font-medium">Ads 16.4% · CPO 191k</div>
                <div className="text-[11px] font-bold text-[var(--text3)] mt-[8px]">Baseline</div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
};
