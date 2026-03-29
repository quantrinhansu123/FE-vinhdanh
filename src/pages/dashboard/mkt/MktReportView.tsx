import React from 'react';
import { SectionCard, Badge } from '../../../components/crm-dashboard/atoms/SharedAtoms';

export const MktReportView: React.FC = () => {
  return (
    <div className="dash-fade-up max-w-[700px] mx-auto">
      <SectionCard 
        title="✏️ Module 7 — Nhập báo cáo hôm nay · 25/03/2025" 
        subtitle="Nguyễn Thị Lan · Team A · BIOKAMA · Cập nhật cuối: 15:42"
        badge={{ text: '⏳ Chưa khóa sổ', type: 'Y' }}
      >
        <div className="bg-[var(--bg3)] border border-[var(--Yb)] rounded-[8px] p-[10px_13px] mb-[14px] text-[11px] text-[var(--Y)]">
          ⚠ Nguyên tắc: Hệ thống chỉ tính giá trị của <strong>lần nhập CUỐI CÙNG</strong> trong ngày, không cộng dồn. Ví dụ: nhập 10h→1.2M, 14h→2.3M, 17h→3.1M ⟹ Hệ thống lấy <strong>3.1M</strong>.
        </div>

        <div className="flex flex-col gap-[10px] mb-[20px]">
          <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-[10px] p-[14px_16px] flex items-center gap-[16px]">
            <div className="font-[var(--mono)] text-[11px] text-[var(--accent)] font-extrabold w-[80px] shrink-0">TK-001</div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-bold text-[var(--text)] truncate">FB Ads BK Main</div>
              <div className="text-[10px] text-[var(--text3)] truncate">Media One · VNĐ · BIOKAMA Official</div>
            </div>
            <div className="flex gap-[12px] shrink-0">
              <div className="text-right">
                <div className="text-[9px] text-[var(--text3)] mb-[4px] uppercase font-bold tracking-[0.5px]">Chi phí (VNĐ)</div>
                <input className="bg-[var(--bg4)] border border-[var(--border)] rounded-[8px] text-[var(--text)] font-[var(--mono)] text-[12px] p-[7px_12px] outline-none w-[120px] text-right focus:border-[var(--accent)] focus:bg-[var(--bg2)] transition-all" value="1.240.000" />
              </div>
              <div className="text-right">
                <div className="text-[9px] text-[var(--text3)] mb-[4px] uppercase font-bold tracking-[0.5px]">Số mess</div>
                <input className="bg-[var(--bg4)] border border-[var(--border)] rounded-[8px] text-[var(--text)] font-[var(--mono)] text-[12px] p-[7px_12px] outline-none w-[100px] text-right focus:border-[var(--accent)] focus:bg-[var(--bg2)] transition-all" value="186" />
              </div>
            </div>
          </div>

          <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-[10px] p-[14px_16px] flex items-center gap-[16px]">
            <div className="font-[var(--mono)] text-[11px] text-[var(--accent)] font-extrabold w-[80px] shrink-0">TK-002</div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-bold text-[var(--text)] truncate">FB Ads BK Backup</div>
              <div className="text-[10px] text-[var(--text3)] truncate">Media One · VNĐ · BK Nông Nghiệp</div>
            </div>
            <div className="flex gap-[12px] shrink-0">
              <div className="text-right">
                <div className="text-[9px] text-[var(--text3)] mb-[4px] uppercase font-bold tracking-[0.5px]">Chi phí (VNĐ)</div>
                <input className="bg-[var(--bg4)] border border-[var(--border)] rounded-[8px] text-[var(--text)] font-[var(--mono)] text-[12px] p-[7px_12px] outline-none w-[120px] text-right focus:border-[var(--accent)] focus:bg-[var(--bg2)] transition-all" value="640.000" />
              </div>
              <div className="text-right">
                <div className="text-[9px] text-[var(--text3)] mb-[4px] uppercase font-bold tracking-[0.5px]">Số mess</div>
                <input className="bg-[var(--bg4)] border border-[var(--border)] rounded-[8px] text-[var(--text)] font-[var(--mono)] text-[12px] p-[7px_12px] outline-none w-[100px] text-right focus:border-[var(--accent)] focus:bg-[var(--bg2)] transition-all" value="98" />
              </div>
            </div>
          </div>
        </div>

        <div className="h-[1px] bg-[var(--border)] my-[12px]" />
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-[12px] gap-y-[14px]">
          <div className="flex flex-col gap-[6px]">
            <div className="text-[10px] font-bold tracking-[0.5px] uppercase text-[var(--text3)]">Tổng data nhận</div>
            <input className="bg-[var(--bg3)] border border-[var(--border)] rounded-[10px] text-[var(--text)] font-[var(--mono)] text-[13px] p-[10px_14px] outline-none focus:border-[var(--accent)] focus:bg-[var(--bg2)] transition-all w-full" value="168" />
          </div>
          <div className="flex flex-col gap-[6px]">
            <div className="text-[10px] font-bold tracking-[0.5px] uppercase text-[var(--text3)]">Doanh số chốt (VNĐ)</div>
            <input className="bg-[var(--bg3)] border border-[var(--border)] rounded-[10px] text-[var(--text)] font-[var(--mono)] text-[13px] p-[10px_14px] outline-none focus:border-[var(--accent)] focus:bg-[var(--bg2)] transition-all w-full" value="12.400.000" />
          </div>
          <div className="flex flex-col gap-[6px]">
            <div className="text-[10px] font-bold tracking-[0.5px] uppercase text-[var(--text3)]">Số đơn chốt</div>
            <input className="bg-[var(--bg3)] border border-[var(--border)] rounded-[10px] text-[var(--text)] font-[var(--mono)] text-[13px] p-[10px_14px] outline-none focus:border-[var(--accent)] focus:bg-[var(--bg2)] transition-all w-full" value="11" />
          </div>
          <div className="flex flex-col gap-[6px]">
            <div className="text-[10px] font-bold tracking-[0.5px] uppercase text-[var(--text3)]">Tổng Lead</div>
            <input className="bg-[var(--bg3)] border border-[var(--border)] rounded-[10px] text-[var(--text)] font-[var(--mono)] text-[13px] p-[10px_14px] outline-none focus:border-[var(--accent)] focus:bg-[var(--bg2)] transition-all w-full" value="42" />
          </div>
          <div className="flex flex-col gap-[6px]">
            <div className="text-[10px] font-bold tracking-[0.5px] uppercase text-[var(--text3)]">Số data chưa chốt</div>
            <input className="bg-[var(--bg3)] border border-[var(--border)] rounded-[10px] text-[var(--text)] font-[var(--mono)] text-[13px] p-[10px_14px] outline-none focus:border-[var(--accent)] focus:bg-[var(--bg2)] transition-all w-full" value="126" />
          </div>
          <div className="flex flex-col gap-[6px]">
            <div className="text-[10px] font-bold tracking-[0.5px] uppercase text-[var(--text3)]">Tỷ lệ chốt</div>
            <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-[10px] text-[var(--G)] font-[var(--mono)] text-[13px] font-bold p-[10px_14px] w-full flex items-center">26.2%</div>
          </div>
        </div>

        <div className="h-[1px] bg-[var(--border)] my-[12px]" />
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-[10px] mt-[12px]">
          <div className="bg-[var(--bg4)] border border-[var(--border)] rounded-[8px] p-[12px_14px]">
            <div className="text-[9px] text-[var(--text3)] mb-[5px] uppercase font-bold tracking-[0.5px]">Ads / Doanh số</div>
            <div className="text-[16px] font-bold text-[var(--G)] font-[var(--mono)]">15.2%</div>
          </div>
          <div className="bg-[var(--bg4)] border border-[var(--border)] rounded-[8px] p-[12px_14px]">
            <div className="text-[9px] text-[var(--text3)] mb-[5px] uppercase font-bold tracking-[0.5px]">Tỷ lệ xin số</div>
            <div className="text-[16px] font-bold text-[var(--text)] font-[var(--mono)]">25.0%</div>
          </div>
          <div className="bg-[var(--bg4)] border border-[var(--border)] rounded-[8px] p-[12px_14px]">
            <div className="text-[9px] text-[var(--text3)] mb-[5px] uppercase font-bold tracking-[0.5px]">Tỷ lệ chốt</div>
            <div className="text-[16px] font-bold text-[var(--G)] font-[var(--mono)]">26.2%</div>
          </div>
          <div className="bg-[var(--bg4)] border border-[var(--border)] rounded-[8px] p-[12px_14px]">
            <div className="text-[9px] text-[var(--text3)] mb-[5px] uppercase font-bold tracking-[0.5px]">AOV</div>
            <div className="text-[16px] font-bold text-[var(--text)] font-[var(--mono)]">1.127k</div>
          </div>
          <div className="bg-[var(--bg4)] border border-[var(--border)] rounded-[8px] p-[12px_14px]">
            <div className="text-[9px] text-[var(--text3)] mb-[5px] uppercase font-bold tracking-[0.5px]">CPO</div>
            <div className="text-[16px] font-bold text-[var(--text)] font-[var(--mono)]">171k</div>
          </div>
          <div className="bg-[var(--bg4)] border border-[var(--border)] rounded-[8px] p-[12px_14px]">
            <div className="text-[9px] text-[var(--text3)] mb-[5px] uppercase font-bold tracking-[0.5px]">CPL</div>
            <div className="text-[16px] font-bold text-[var(--text)] font-[var(--mono)]">45k</div>
          </div>
        </div>

        <div className="mt-[24px] flex gap-[12px]">
          <button className="bg-[var(--accent)] text-[#fff] flex-1 py-[11px] rounded-[10px] text-[13px] font-black flex items-center justify-center gap-[8px] shadow-lg shadow-[rgba(61,142,240,0.3)] hover:brightness-110 active:scale-[0.98] transition-all whitespace-nowrap">
            💾 Lưu báo cáo
          </button>
          <button className="bg-[var(--bg3)] border border-[var(--border)] text-[var(--text2)] flex-1 py-[10px] rounded-[10px] text-[13px] font-extrabold flex items-center justify-center gap-[6px] hover:bg-[var(--bg4)] transition-all">
            📋 Xem bill
          </button>
        </div>
      </SectionCard>
    </div>
  );
};
