import React from 'react';
import { KpiCard } from '../../../components/crm-dashboard/atoms/KpiCard';
import { SectionCard, ProgressRow } from '../../../components/crm-dashboard/atoms/SharedAtoms';

export const LeaderDashboardView: React.FC = () => {
  return (
    <div className="dash-fade-up">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-[10px] mb-[14px]">
        <KpiCard label="DT Team A" value="855M" sub="Mục tiêu: 1.2B" delta="71% KPI" deltaType="up" barColor="var(--G)" animationDelay={0.03} valueSize="xl" />
        <KpiCard label="CHI PHÍ ADS" value="201M" sub="Ads/DT: 23.5%" delta="An toàn" deltaType="nt" barColor="var(--accent)" animationDelay={0.05} valueSize="xl" />
        <KpiCard label="TỔNG LEAD" value="3.840" sub="CPL: 52.3k" delta="Tuần này" deltaType="up" barColor="var(--P)" animationDelay={0.07} valueSize="xl" />
        <KpiCard label="ĐƠN CHỐT" value="956" sub="Tỷ lệ: 24.9%" delta="AOV: 894k" deltaType="up" barColor="var(--Y)" animationDelay={0.09} valueSize="xl" />
        <KpiCard label="MKT HOẠT ĐỘNG" value="5" sub="Team A" delta="OK" deltaType="nt" barColor="var(--G)" animationDelay={0.11} valueSize="xl" />
        <KpiCard label="CẦN XỬ LÝ" value="1" sub="Ads/DT > 35%" delta="Phạm QH" deltaType="dn" barColor="var(--R)" animationDelay={0.13} valueColor="var(--R)" valueSize="xl" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-[14px]">
        <div className="lg:col-span-2">
          <SectionCard title="📊 Hiệu suất từng Marketing — Team A" subtitle="Tháng 03/2025 · 5 thành viên" bodyPadding={false}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[1000px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[9px] font-bold tracking-[1px] uppercase text-[var(--text3)] text-left">
                    <th className="p-[7px_12px] text-center">#</th>
                    <th className="p-[7px_12px]">Marketing</th>
                    <th className="p-[7px_12px] text-right">Doanh số</th>
                    <th className="p-[7px_12px] text-right">Ads</th>
                    <th className="p-[7px_12px] text-right">Ads/DT</th>
                    <th className="p-[7px_12px] text-right">Lead</th>
                    <th className="p-[7px_12px] text-right">Đơn</th>
                    <th className="p-[7px_12px] text-right">Chốt%</th>
                    <th className="p-[7px_12px] text-right">AOV</th>
                    <th className="p-[7px_12px] text-right">CPO</th>
                    <th className="p-[7px_12px] text-right">CPL</th>
                    <th className="p-[7px_12px] text-right">CPA</th>
                  </tr>
                </thead>
                <tbody className="text-[11.5px] text-[var(--text2)]">
                  {/* Row 1 */}
                  <tr className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                    <td className="p-[9px_12px] text-center font-[var(--mono)] text-[var(--gold)] font-bold">1</td>
                    <td className="p-[9px_12px]"><div className="font-bold text-[var(--text)]">Nguyễn Thị Lan</div><div className="text-[10px] text-[var(--text3)]">TK-001,002</div></td>
                    <td className="p-[9px_12px] text-right text-[var(--G)] font-bold">342M</td>
                    <td className="p-[9px_12px] text-right">52M</td>
                    <td className="p-[9px_12px] text-right"><span className="p-[2px_7px] bg-[var(--Gd)] text-[var(--G)] rounded-[4px] text-[9.5px] font-bold">15.2%</span></td>
                    <td className="p-[9px_12px] text-right">1.240</td>
                    <td className="p-[9px_12px] text-right">334</td>
                    <td className="p-[9px_12px] text-right text-[var(--G)]">26.9%</td>
                    <td className="p-[9px_12px] text-right">1.024k</td>
                    <td className="p-[9px_12px] text-right">155k</td>
                    <td className="p-[9px_12px] text-right">42k</td>
                    <td className="p-[9px_12px] text-right">6.6k</td>
                  </tr>
                  {/* Row 2 */}
                  <tr className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                    <td className="p-[9px_12px] text-center font-[var(--mono)] text-[var(--text3)] font-bold">2</td>
                    <td className="p-[9px_12px]"><div className="font-bold text-[var(--text)]">Trần Văn Minh</div><div className="text-[10px] text-[var(--text3)]">TK-003</div></td>
                    <td className="p-[9px_12px] text-right text-[var(--text)] font-bold">298M</td>
                    <td className="p-[9px_12px] text-right">61M</td>
                    <td className="p-[9px_12px] text-right"><span className="p-[2px_7px] bg-[var(--Gd)] text-[var(--G)] rounded-[4px] text-[9.5px] font-bold">20.5%</span></td>
                    <td className="p-[9px_12px] text-right">980</td>
                    <td className="p-[9px_12px] text-right">265</td>
                    <td className="p-[9px_12px] text-right">27.0%</td>
                    <td className="p-[9px_12px] text-right">1.124k</td>
                    <td className="p-[9px_12px] text-right">230k</td>
                    <td className="p-[9px_12px] text-right">62k</td>
                    <td className="p-[9px_12px] text-right">8.9k</td>
                  </tr>
                  {/* Row 3 */}
                  <tr className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                    <td className="p-[9px_12px] text-center font-[var(--mono)] text-[var(--text3)] font-bold">3</td>
                    <td className="p-[9px_12px]"><div className="font-bold text-[var(--text)]">Lê Thị Hoa</div><div className="text-[10px] text-[var(--text3)]">TK-004</div></td>
                    <td className="p-[9px_12px] text-right text-[var(--Y)] font-bold">215M</td>
                    <td className="p-[9px_12px] text-right">48M</td>
                    <td className="p-[9px_12px] text-right"><span className="p-[2px_7px] bg-[var(--Yd)] text-[var(--Y)] rounded-[4px] text-[9.5px] font-bold">22.3%</span></td>
                    <td className="p-[9px_12px] text-right">840</td>
                    <td className="p-[9px_12px] text-right">193</td>
                    <td className="p-[9px_12px] text-right">23.0%</td>
                    <td className="p-[9px_12px] text-right">1.114k</td>
                    <td className="p-[9px_12px] text-right">249k</td>
                    <td className="p-[9px_12px] text-right">57k</td>
                    <td className="p-[9px_12px] text-right">9.3k</td>
                  </tr>
                  {/* Row 4 - Critical */}
                  <tr className="bg-[rgba(224,61,61,0.05)] border-b border-[rgba(224,61,61,0.1)] hover:bg-[rgba(224,61,61,0.08)] transition-colors">
                    <td className="p-[9px_12px] text-center font-[var(--mono)] text-[var(--R)] font-bold">!</td>
                    <td className="p-[9px_12px]"><div className="font-bold text-[var(--Y)]">Phạm Quốc Hùng</div><div className="text-[10px] text-[var(--text3)]">TK-006</div></td>
                    <td className="p-[9px_12px] text-right text-[var(--Y)] font-bold">76M</td>
                    <td className="p-[9px_12px] text-right text-[var(--R)]">40M</td>
                    <td className="p-[9px_12px] text-right"><span className="p-[2px_7px] bg-[var(--Rd)] text-[var(--R)] rounded-[4px] text-[9.5px] font-bold">52.6%</span></td>
                    <td className="p-[9px_12px] text-right">240</td>
                    <td className="p-[9px_12px] text-right">34</td>
                    <td className="p-[9px_12px] text-right text-[var(--R)]">14.2%</td>
                    <td className="p-[9px_12px] text-right">2.235k</td>
                    <td className="p-[9px_12px] text-right">1.176k</td>
                    <td className="p-[9px_12px] text-right">167k</td>
                    <td className="p-[9px_12px] text-right">54k</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
        <div>
          <SectionCard title="🎯 Tiến độ KPI tháng">
            <ProgressRow label="Nguyễn Thị Lan" valueText="342M / 400M" percent={85.5} color="var(--G)" subLabel="85.5%" />
            <ProgressRow label="Trần Văn Minh" valueText="298M / 350M" percent={85.1} color="var(--accent)" subLabel="85.1%" />
            <ProgressRow label="Lê Thị Hoa" valueText="215M / 300M" percent={71.7} color="var(--Y)" subLabel="71.7%" />
            <ProgressRow label="Phạm Quốc Hùng" valueText="76M / 250M" percent={30.4} color="var(--R)" subLabel="30.4% ⚠" />
          </SectionCard>
        </div>
      </div>
    </div>
  );
};
