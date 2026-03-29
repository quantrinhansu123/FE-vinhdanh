import React from 'react';
import { KpiCard } from '../../../components/crm-dashboard/atoms/KpiCard';
import { SectionCard, ProgressRow, Badge } from '../../../components/crm-dashboard/atoms/SharedAtoms';

export const MktDashboardView: React.FC = () => {
  return (
    <div className="dash-fade-up">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[10px] mb-[14px]">
        <KpiCard label="Doanh số hôm nay" value="12.400.000" sub="VNĐ" delta="+18% hôm qua" deltaType="up" barColor="var(--G)" animationDelay={0.03} valueSize="lg" />
        <KpiCard label="Chi phí Ads hôm nay" value="1.880.000" sub="Ads/DT: 15.2%" delta="An toàn" deltaType="up" barColor="var(--accent)" animationDelay={0.06} valueSize="lg" />
        <KpiCard label="Lead hôm nay" value="42" sub="11 đơn chốt" delta="Chốt: 26.2%" deltaType="up" barColor="var(--P)" animationDelay={0.09} valueSize="lg" />
        <KpiCard label="DT tháng của tôi" value="342.000.000" sub="Mục tiêu: 400M" delta="85.5% KPI" deltaType="up" barColor="var(--Y)" animationDelay={0.12} valueSize="lg" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[14px]">
        <SectionCard title="📅 Hiệu suất 7 ngày" bodyPadding={false}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] text-[9px] font-bold tracking-[1px] uppercase text-[var(--text3)] text-left">
                  <th className="p-[7px_12px]">Ngày</th>
                  <th className="p-[7px_12px] text-right">DT</th>
                  <th className="p-[7px_12px] text-right">Ads</th>
                  <th className="p-[7px_12px] text-right">Ads/DT</th>
                  <th className="p-[7px_12px] text-right">Lead</th>
                  <th className="p-[7px_12px] text-right">Đơn</th>
                  <th className="p-[7px_12px] text-right">Chốt%</th>
                </tr>
              </thead>
              <tbody className="text-[11.5px] text-[var(--text2)] font-[var(--mono)]">
                <tr className="border-b border-[rgba(255,255,255,0.03)] transition-colors hover:bg-[rgba(255,255,255,0.02)]">
                  <td className="p-[9px_12px]">25/03</td>
                  <td className="p-[9px_12px] text-right text-[var(--G)] font-extrabold">12.4M</td>
                  <td className="p-[9px_12px] text-right">1.88M</td>
                  <td className="p-[9px_12px] text-right"><Badge type="G">15.2%</Badge></td>
                  <td className="p-[9px_12px] text-right">42</td>
                  <td className="p-[9px_12px] text-right">11</td>
                  <td className="p-[9px_12px] text-right text-[var(--G)]">26.2%</td>
                </tr>
                <tr className="border-b border-[rgba(255,255,255,0.03)] transition-colors hover:bg-[rgba(255,255,255,0.02)]">
                  <td className="p-[9px_12px]">24/03</td>
                  <td className="p-[9px_12px] text-right">10.5M</td>
                  <td className="p-[9px_12px] text-right">1.72M</td>
                  <td className="p-[9px_12px] text-right"><Badge type="G">16.4%</Badge></td>
                  <td className="p-[9px_12px] text-right">38</td>
                  <td className="p-[9px_12px] text-right">9</td>
                  <td className="p-[9px_12px] text-right">23.7%</td>
                </tr>
                <tr className="border-b border-[rgba(255,255,255,0.03)] transition-colors hover:bg-[rgba(255,255,255,0.02)]">
                  <td className="p-[9px_12px]">23/03</td>
                  <td className="p-[9px_12px] text-right">14.2M</td>
                  <td className="p-[9px_12px] text-right">2.14M</td>
                  <td className="p-[9px_12px] text-right"><Badge type="G">15.1%</Badge></td>
                  <td className="p-[9px_12px] text-right">51</td>
                  <td className="p-[9px_12px] text-right">14</td>
                  <td className="p-[9px_12px] text-right">27.5%</td>
                </tr>
                <tr className="border-b border-[rgba(255,255,255,0.03)] transition-colors hover:bg-[rgba(255,255,255,0.02)]">
                  <td className="p-[9px_12px]">22/03</td>
                  <td className="p-[9px_12px] text-right">11.8M</td>
                  <td className="p-[9px_12px] text-right">1.64M</td>
                  <td className="p-[9px_12px] text-right"><Badge type="G">13.9%</Badge></td>
                  <td className="p-[9px_12px] text-right">44</td>
                  <td className="p-[9px_12px] text-right">12</td>
                  <td className="p-[9px_12px] text-right">27.3%</td>
                </tr>
                <tr className="border-b border-[rgba(255,255,255,0.03)] transition-colors hover:bg-[rgba(255,255,255,0.02)]">
                  <td className="p-[9px_12px]">21/03</td>
                  <td className="p-[9px_12px] text-right">9.2M</td>
                  <td className="p-[9px_12px] text-right">1.39M</td>
                  <td className="p-[9px_12px] text-right"><Badge type="G">15.1%</Badge></td>
                  <td className="p-[9px_12px] text-right">32</td>
                  <td className="p-[9px_12px] text-right">7</td>
                  <td className="p-[9px_12px] text-right text-[var(--R)]">21.9%</td>
                </tr>
                <tr className="border-b border-[rgba(255,255,255,0.03)] transition-colors hover:bg-[rgba(255,255,255,0.02)]">
                  <td className="p-[9px_12px]">20/03</td>
                  <td className="p-[9px_12px] text-right">13.1M</td>
                  <td className="p-[9px_12px] text-right">1.95M</td>
                  <td className="p-[9px_12px] text-right"><Badge type="G">14.9%</Badge></td>
                  <td className="p-[9px_12px] text-right">48</td>
                  <td className="p-[9px_12px] text-right">13</td>
                  <td className="p-[9px_12px] text-right">27.1%</td>
                </tr>
                <tr className="border-[0] transition-colors hover:bg-[rgba(255,255,255,0.02)]">
                  <td className="p-[9px_12px]">19/03</td>
                  <td className="p-[9px_12px] text-right">11.5M</td>
                  <td className="p-[9px_12px] text-right">1.70M</td>
                  <td className="p-[9px_12px] text-right"><Badge type="G">14.8%</Badge></td>
                  <td className="p-[9px_12px] text-right">40</td>
                  <td className="p-[9px_12px] text-right">10</td>
                  <td className="p-[9px_12px] text-right">25.0%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </SectionCard>

        <div className="flex flex-col gap-[14px]">
          <SectionCard title="🎯 KPI tháng của tôi">
            <ProgressRow label="Doanh số" valueText="342M / 400M" percent={85.5} color="var(--G)" height={8} />
            <ProgressRow label="Lead" valueText="1.240 / 1.500" percent={83} color="var(--P)" height={8} />
            <ProgressRow label="Đơn chốt" valueText="334 / 400" percent={83} color="var(--Y)" height={8} />
          </SectionCard>
          
          <SectionCard title="🎯 Tài khoản Ads">
            <div className="flex flex-col gap-[6px]">
              <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-[8px] p-[11px_14px] flex items-center gap-[12px]">
                <div className="font-[var(--mono)] text-[10.5px] text-[var(--accent)] font-bold w-[90px] shrink-0">TK-001</div>
                <div className="flex-1">
                  <div className="text-[11.5px] font-bold text-[var(--text)]">FB Ads BK Main</div>
                  <div className="text-[9.5px] text-[var(--text3)]">Media One · VNĐ</div>
                </div>
                <Badge type="G">Active</Badge>
              </div>
              <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-[8px] p-[11px_14px] flex items-center gap-[12px]">
                <div className="font-[var(--mono)] text-[10.5px] text-[var(--accent)] font-bold w-[90px] shrink-0">TK-002</div>
                <div className="flex-1">
                  <div className="text-[11.5px] font-bold text-[var(--text)]">FB Ads BK Backup</div>
                  <div className="text-[9.5px] text-[var(--text3)]">Media One · VNĐ</div>
                </div>
                <Badge type="G">Active</Badge>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
};
