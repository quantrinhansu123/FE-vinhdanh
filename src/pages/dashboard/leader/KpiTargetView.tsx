import React from 'react';
import { SectionCard } from '../../../components/crm-dashboard/atoms/SharedAtoms';

export const KpiTargetView: React.FC = () => {
  return (
    <div className="dash-fade-up">
      <SectionCard title="🎯 Thiết lập KPI & Mục tiêu doanh thu tháng">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[20px] mb-[24px]">
          <div>
            <label className="block text-[10px] font-bold text-[var(--text3)] uppercase tracking-[1px] mb-[8px]">
              Doanh thu mục tiêu cả Team A
            </label>
            <input 
              type="text" 
              defaultValue="1.500.000.000"
              className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-[8px] p-[10px_14px] text-[13px] font-bold text-[var(--accent)] outline-none focus:border-[var(--accent)] transition-all"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[var(--text3)] uppercase tracking-[1px] mb-[8px]">
              Tháng áp dụng
            </label>
            <input 
              type="text" 
              defaultValue="03/2025"
              className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-[8px] p-[10px_14px] text-[13px] font-bold text-[var(--text2)] outline-none focus:border-[var(--accent)] transition-all"
            />
          </div>
        </div>

        <div className="space-y-[12px] mb-[24px]">
          <div className="text-[10px] font-extrabold text-[var(--text3)] uppercase tracking-[1.5px] pb-[8px] border-b border-[var(--border)]">
            Phân bổ theo MKT — MKT tự đề xuất
          </div>
          
          {[
            { id: 'MK-001', name: 'Nguyễn Thị Lan', target: '400.000.000' },
            { id: 'MK-002', name: 'Trần Văn Minh', target: '350.000.000' },
            { id: 'MK-003', name: 'Lê Thị Hoa', target: '300.000.000' },
            { id: 'MK-004', name: 'Phạm Quốc Hùng', target: '250.000.000' },
          ].map((mkt) => (
            <div key={mkt.id} className="flex items-center justify-between p-[12px_16px] bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] rounded-[10px] group hover:border-[rgba(61,142,240,0.3)] transition-all">
              <div className="flex items-center gap-[16px]">
                <span className="text-[11px] font-bold text-[#3d8ef0] w-[50px]">{mkt.id}</span>
                <span className="text-[12px] font-extrabold text-[#fff]">{mkt.name}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[9px] text-[var(--text3)] uppercase font-bold mb-[4px]">Mục tiêu (VND)</span>
                <input 
                  type="text" 
                  defaultValue={mkt.target}
                  className="w-[140px] bg-[var(--bg4)] border border-[var(--border)] rounded-[6px] p-[6px_10px] text-[12px] font-bold text-right text-[var(--text)] outline-none focus:border-[var(--accent)] transition-all"
                />
              </div>
            </div>
          ))}
        </div>

        <button className="flex items-center gap-[8px] bg-[#3d8ef0] hover:bg-[#2e7dd1] text-white p-[10px_24px] rounded-[8px] text-[12px] font-bold transition-all shadow-[0_4px_16px_rgba(61,142,240,0.3)]">
          💾 Lưu mục tiêu
        </button>
      </SectionCard>
    </div>
  );
};
