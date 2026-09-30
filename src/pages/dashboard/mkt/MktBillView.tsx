import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { BillCard } from '../../../components/crm-dashboard/atoms/SharedAtoms';
import { crmAdminPathForView } from '../../../utils/crmAdminRoutes';
import { StitchButton } from '../../../components/ui/StitchUI';
import '../../../styles/stitchSystem.css';

export const MktBillView: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="dash-fade-up space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-[#e2e8e5]">
        <div>
          <h1 className="text-2xl font-extrabold text-[#191c1b] tracking-tight">Bill Hiệu suất MKT</h1>
          <p className="mt-1 text-xs text-[#476355]">Phiếu sao kê hiệu suất và công thức quy đổi chỉ số báo cáo</p>
        </div>
        <StitchButton
          variant="secondary"
          size="small"
          onClick={() => navigate(crmAdminPathForView('mkt-report'))}
        >
          <ArrowLeft size={14} />
          Quay lại Báo cáo MKT
        </StitchButton>
      </div>

      <div className="flex flex-wrap gap-6 items-start">
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

        <div className="flex-1 min-w-[300px] flex flex-col gap-6">
          <section className="bg-white rounded-2xl border border-[#e2e8e5] p-5 shadow-xs">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#191c1b] mb-4">
              📐 Công thức chuẩn hóa
            </h2>
            <div className="flex flex-col gap-2">
              <div className="bg-[#f8faf9] border border-[#e2e8e5] rounded-xl px-4 py-2.5 flex justify-between items-center h-10">
                <span className="text-xs text-[#476355] font-semibold">% Ads / Doanh số</span>
                <span className="font-mono text-xs text-[#006e51] font-bold">Chi phí Ads ÷ Doanh số</span>
              </div>
              <div className="bg-[#f8faf9] border border-[#e2e8e5] rounded-xl px-4 py-2.5 flex justify-between items-center h-10">
                <span className="text-xs text-[#476355] font-semibold">Tỷ lệ xin số</span>
                <span className="font-mono text-xs text-[#006e51] font-bold">Tổng Lead ÷ Tổng Mess</span>
              </div>
              <div className="bg-[#f8faf9] border border-[#e2e8e5] rounded-xl px-4 py-2.5 flex justify-between items-center h-10">
                <span className="text-xs text-[#476355] font-semibold">AOV</span>
                <span className="font-mono text-xs text-[#006e51] font-bold">Doanh số ÷ Tổng đơn chốt</span>
              </div>
              <div className="bg-[#f8faf9] border border-[#e2e8e5] rounded-xl px-4 py-2.5 flex justify-between items-center h-10">
                <span className="text-xs text-[#476355] font-semibold">CPO</span>
                <span className="font-mono text-xs text-[#006e51] font-bold">Chi phí Ads ÷ Tổng đơn chốt</span>
              </div>
              <div className="bg-[#f8faf9] border border-[#e2e8e5] rounded-xl px-4 py-2.5 flex justify-between items-center h-10">
                <span className="text-xs text-[#476355] font-semibold">CPL</span>
                <span className="font-mono text-xs text-[#006e51] font-bold">Chi phí Ads ÷ Tổng lead</span>
              </div>
              <div className="bg-[#f8faf9] border border-[#e2e8e5] rounded-xl px-4 py-2.5 flex justify-between items-center h-10">
                <span className="text-xs text-[#476355] font-semibold">CPA</span>
                <span className="font-mono text-xs text-[#006e51] font-bold">Chi phí Ads ÷ Tổng mess</span>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-[#e2e8e5] p-5 shadow-xs">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#191c1b] mb-4">
              📊 So sánh hôm nay vs hôm qua
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#f8faf9] rounded-xl border border-[#e2e8e5] p-4 relative overflow-hidden border-l-4 border-l-[#006e51]">
                <div className="text-[10px] font-extrabold tracking-widest uppercase text-[#476355] mb-2">Hôm nay</div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-2xl font-black text-[#006e51]">12.4M đ</span>
                </div>
                <div className="text-xs text-[#476355] mt-1 font-medium">Ads 15.2% · CPO 171k</div>
                <div className="text-xs font-bold text-[#059669] mt-2 flex items-center gap-1">
                  <span>▲</span> +18% doanh số
                </div>
              </div>

              <div className="bg-[#f8faf9] rounded-xl border border-[#e2e8e5] p-4 relative overflow-hidden border-l-4 border-l-[#8b9b94]">
                <div className="text-[10px] font-extrabold tracking-widest uppercase text-[#476355] mb-2">Hôm qua</div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-2xl font-black text-[#191c1b]">10.5M đ</span>
                </div>
                <div className="text-xs text-[#476355] mt-1 font-medium">Ads 16.4% · CPO 191k</div>
                <div className="text-xs font-medium text-[#476355] mt-2">Baseline so sánh</div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
