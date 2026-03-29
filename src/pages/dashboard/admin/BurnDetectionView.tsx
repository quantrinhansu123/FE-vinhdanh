import React from 'react';
import { KpiCard } from '../../../components/crm-dashboard/atoms/KpiCard';
import { SectionCard, Badge } from '../../../components/crm-dashboard/atoms/SharedAtoms';

export const BurnDetectionView: React.FC = () => {
  return (
    <div className="dash-fade-up">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-[14px] mb-[14px]">
        {/* KPI: Critical */}
        <div className="bg-[rgba(224,61,61,0.06)] border border-[rgba(224,61,61,0.15)] rounded-[var(--r)] p-[14px_16px] relative overflow-hidden transition-all duration-200">
          <div className="absolute top-0 left-0 w-[3px] h-full bg-[var(--R)] opacity-40" />
          <div className="text-[9.5px] font-extrabold tracking-[1.2px] uppercase text-[rgba(224,61,61,0.55)] mb-[6px]">Đốt tiền nghiêm trọng</div>
          <div className="text-[22px] font-[var(--mono)] font-extrabold text-[var(--R)] leading-none mb-[5px]">2</div>
          <div className="text-[9.5px] text-[RGBA(224,61,61,0.5)] font-bold">Ads/DT &gt; 45% · Xử lý ngay</div>
        </div>

        {/* KPI: Warning */}
        <div className="bg-[rgba(255,178,36,0.06)] border border-[rgba(255,178,36,0.15)] rounded-[var(--r)] p-[14px_16px] relative overflow-hidden transition-all duration-200">
          <div className="absolute top-0 left-0 w-[3px] h-full bg-[var(--Y)] opacity-40" />
          <div className="text-[9.5px] font-extrabold tracking-[1.2px] uppercase text-[rgba(255,178,36,0.6)] mb-[6px]">Cần theo dõi</div>
          <div className="text-[22px] font-[var(--mono)] font-extrabold text-[var(--Y)] leading-none mb-[5px]">1</div>
          <div className="text-[9.5px] text-[rgba(255,178,36,0.55)] font-bold">Ads/DT 30–45%</div>
        </div>

        {/* KPI: Optimal */}
        <div className="bg-[rgba(15,168,109,0.06)] border border-[rgba(15,168,109,0.15)] rounded-[var(--r)] p-[14px_16px] relative overflow-hidden transition-all duration-200">
          <div className="absolute top-0 left-0 w-[3px] h-full bg-[var(--G)] opacity-40" />
          <div className="text-[9.5px] font-extrabold tracking-[1.2px] uppercase text-[rgba(15,168,109,0.65)] mb-[6px]">Hiệu quả tốt</div>
          <div className="text-[22px] font-[var(--mono)] font-extrabold text-[var(--G)] leading-none mb-[5px]">11</div>
          <div className="text-[9.5px] text-[rgba(15,168,109,0.6)] font-bold">Ads/DT &lt; 30%</div>
        </div>
      </div>

      <SectionCard 
        title="🔥 Bảng phát hiện đốt tiền — 24H gần nhất" 
        subtitle="Dữ liệu từ lần nhập cuối cùng trong ngày của từng MKT · Burn Score = tổng điểm rủi ro"
        actions={<button className="btn-ghost py-[4.5px] px-[12px] rounded-[6px] text-[10.5px] bg-[rgba(255,255,255,0.05)] text-[var(--text2)] border-[var(--border)]"><span className="opacity-60 mr-[5px]">⬇</span> Xuất báo cáo</button>}
        bodyPadding={false}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] text-[9px] font-extrabold tracking-[1.2px] uppercase text-[var(--text3)] text-left">
                <th className="p-[8px_14px]">Marketing</th>
                <th className="p-[8px_14px] text-right">Ads Chi</th>
                <th className="p-[8px_14px] text-right">Revenue</th>
                <th className="p-[8px_14px] text-right">Ads%</th>
                <th className="p-[8px_14px] text-right">Mess</th>
                <th className="p-[8px_14px] text-right">Lead</th>
                <th className="p-[8px_14px] text-right">Đơn</th>
                <th className="p-[8px_14px] text-right">CPL</th>
                <th className="p-[8px_14px] text-right">CPO</th>
                <th className="p-[8px_14px] text-center">Close%</th>
                <th className="p-[8px_14px] text-right">Waste</th>
                <th className="p-[8px_14px] text-right">Burn Score</th>
                <th className="p-[8px_14px]">HÀNH ĐỘNG</th>
              </tr>
            </thead>
            <tbody className="text-[11.5px] text-[var(--text2)]">
              {/* Row: MKT C */}
              <tr className="border-b border-[rgba(224,61,61,0.08)] bg-[rgba(224,61,61,0.035)] hover:bg-[rgba(224,61,61,0.05)] transition-colors">
                <td className="p-[10px_14px]">
                  <div className="font-bold text-[var(--R)] text-[12px] tracking-[0.2px]">MKT C</div>
                  <div className="text-[10px] text-[rgba(224,61,61,0.6)] mt-[1.5px] font-bold">Team B · MASSHU</div>
                </td>
                <td className="p-[10px_14px] text-right font-[var(--mono)] text-[var(--R)] font-bold">4.800.000</td>
                <td className="p-[10px_14px] text-right font-[var(--mono)] text-[var(--text2)]">7.000.000</td>
                <td className="p-[10px_14px] text-right"><span className="bg-[rgba(224,61,61,0.2)] text-[var(--R)] p-[2.5px_8px] rounded-[4px] text-[10px] font-bold">68%</span></td>
                <td className="p-[10px_14px] text-right font-[var(--mono)]">260</td>
                <td className="p-[10px_14px] text-right font-[var(--mono)]">40</td>
                <td className="p-[10px_14px] text-right font-[var(--mono)]">8</td>
                <td className="p-[10px_14px] text-right font-[var(--mono)] text-[var(--R)]">120.000</td>
                <td className="p-[10px_14px] text-right font-[var(--mono)] text-[var(--R)]">600.000</td>
                <td className="p-[10px_14px] text-center font-[var(--mono)] text-[var(--Y)] font-bold">20%</td>
                <td className="p-[10px_14px] text-right font-[var(--mono)] text-[var(--R)] font-bold shadow-[inset_0_0_10px_rgba(224,61,61,0.05)]">2.350.000</td>
                <td className="p-[10px_14px] text-right"><div className="font-[var(--mono)] text-[12.5px] font-extrabold text-[var(--R)] drop-shadow-[0_0_4px_rgba(224,61,61,0.2)]">84</div></td>
                <td className="p-[10px_14px]"><button className="text-[9px] font-extrabold p-[3px_10px] rounded-[6px] border border-[rgba(224,61,61,0.25)] bg-[rgba(224,61,61,0.08)] text-[var(--R)] uppercase whitespace-nowrap hover:bg-[var(--R)] hover:text-[#fff] transition-all">Kiểm tra content + target</button></td>
              </tr>

              {/* Row: MKT A */}
              <tr className="border-b border-[rgba(224,61,61,0.08)] bg-[rgba(224,61,61,0.02)] hover:bg-[rgba(224,61,61,0.04)] transition-colors">
                <td className="p-[10px_14px]">
                  <div className="font-bold text-[var(--R)] text-[12px] tracking-[0.2px]">MKT A</div>
                  <div className="text-[10px] text-[rgba(224,61,61,0.6)] mt-[1.5px] font-bold">Team C · BIOKAMA</div>
                </td>
                <td className="p-[10px_14px] text-right font-[var(--mono)] text-[var(--R)] font-bold">5.200.000</td>
                <td className="p-[10px_14px] text-right font-[var(--mono)] text-[var(--text2)]">8.900.000</td>
                <td className="p-[10px_14px] text-right"><span className="bg-[rgba(224,61,61,0.2)] text-[var(--R)] p-[2.5px_8px] rounded-[4px] text-[10px] font-bold">58%</span></td>
                <td className="p-[10px_14px] text-right font-[var(--mono)]">310</td>
                <td className="p-[10px_14px] text-right font-[var(--mono)]">62</td>
                <td className="p-[10px_14px] text-right font-[var(--mono)]">11</td>
                <td className="p-[10px_14px] text-right font-[var(--mono)] text-[var(--R)]">83.871</td>
                <td className="p-[10px_14px] text-right font-[var(--mono)] text-[var(--R)]">472.727</td>
                <td className="p-[10px_14px] text-center font-[var(--mono)] text-[rgba(224,61,61,0.6)] font-bold">17.7%</td>
                <td className="p-[10px_14px] text-right font-[var(--mono)] text-[var(--R)] font-bold">2.885.000</td>
                <td className="p-[10px_14px] text-right"><div className="font-[var(--mono)] text-[12.5px] font-extrabold text-[var(--R)]">78</div></td>
                <td className="p-[10px_14px]"><button className="text-[9px] font-extrabold p-[3px_10px] rounded-[6px] border border-[rgba(224,61,61,0.25)] bg-[rgba(224,61,61,0.08)] text-[var(--R)] uppercase whitespace-nowrap hover:bg-[var(--R)] hover:text-[#fff] transition-all">Giảm 20% ngân sách</button></td>
              </tr>

              {/* Row: MKT D */}
              <tr className="border-b border-[rgba(255,178,36,0.06)] hover:bg-[rgba(255,178,36,0.03)] transition-colors">
                <td className="p-[10px_14px]">
                  <div className="font-bold text-[var(--Y)] text-[12px] tracking-[0.2px]">MKT D</div>
                  <div className="text-[10px] text-[var(--text3)] mt-[1.5px]">Team A · FABCO</div>
                </td>
                <td className="p-[10px_14px] text-right font-[var(--mono)] text-[var(--Y)] font-bold">3.800.000</td>
                <td className="p-[10px_14px] text-right font-[var(--mono)]">9.200.000</td>
                <td className="p-[10px_14px] text-right"><span className="bg-[rgba(255,178,36,0.15)] text-[var(--Y)] p-[2.5px_8px] rounded-[4px] text-[10px] font-bold">41%</span></td>
                <td className="p-[10px_14px] text-right font-[var(--mono)]">290</td>
                <td className="p-[10px_14px] text-right font-[var(--mono)]">68</td>
                <td className="p-[10px_14px] text-right font-[var(--mono)]">14</td>
                <td className="p-[10px_14px] text-right font-[var(--mono)] text-[var(--text2)]">55.882</td>
                <td className="p-[10px_14px] text-right font-[var(--mono)] text-[var(--text2)]">271.428</td>
                <td className="p-[10px_14px] text-center font-[var(--mono)] text-[var(--text2)]">20.6%</td>
                <td className="p-[10px_14px] text-right font-[var(--mono)] text-[var(--Y)] font-bold">184.000</td>
                <td className="p-[10px_14px] text-right"><div className="font-[var(--mono)] text-[12.5px] font-extrabold text-[var(--Y)]">42</div></td>
                <td className="p-[10px_14px]"><button className="text-[9px] font-extrabold p-[3px_10px] rounded-[6px] border border-[rgba(255,178,36,0.25)] bg-[rgba(255,178,36,0.08)] text-[var(--Y)] uppercase whitespace-nowrap hover:bg-[var(--Y)] hover:text-[#fff] transition-all">Theo dõi thêm 1 ngày</button></td>
              </tr>

              {/* Row: MKT B */}
              <tr className="hover:bg-[rgba(15,168,109,0.04)] transition-colors">
                <td className="p-[10px_14px]">
                  <div className="font-bold text-[var(--text)] text-[12px] tracking-[0.2px]">MKT B</div>
                  <div className="text-[10px] text-[var(--text3)] mt-[1.5px]">Team A · BIOKAMA</div>
                </td>
                <td className="p-[10px_14px] text-right font-[var(--mono)] text-[var(--text3)]">3.100.000</td>
                <td className="p-[10px_14px] text-right font-[var(--mono)]">10.500.000</td>
                <td className="p-[10px_14px] text-right"><span className="bg-[rgba(15,168,109,0.15)] text-[var(--G)] p-[2.5px_8px] rounded-[4px] text-[10px] font-bold">29.5%</span></td>
                <td className="p-[10px_14px] text-right font-[var(--mono)]">280</td>
                <td className="p-[10px_14px] text-right font-[var(--mono)]">75</td>
                <td className="p-[10px_14px] text-right font-[var(--mono)]">19</td>
                <td className="p-[10px_14px] text-right font-[var(--mono)] text-[var(--text2)]">41.333</td>
                <td className="p-[10px_14px] text-right font-[var(--mono)] text-[var(--text2)]">163.157</td>
                <td className="p-[10px_14px] text-center font-[var(--mono)] text-[var(--G)] font-bold">25.3%</td>
                <td className="p-[10px_14px] text-right font-[var(--mono)] text-[var(--text3)]">0</td>
                <td className="p-[10px_14px] text-right"><div className="font-[var(--mono)] text-[12.5px] font-extrabold text-[var(--G)] opacity-60">18</div></td>
                <td className="p-[10px_14px]"><button className="text-[9px] font-extrabold p-[3px_10px] rounded-[6px] border border-[rgba(15,168,109,0.25)] bg-[rgba(15,168,109,0.08)] text-[var(--G)] uppercase whitespace-nowrap hover:bg-[var(--G)] hover:text-[#fff] transition-all">Giữ nguyên</button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="p-[14px_16px] border-t border-[var(--border)] bg-[rgba(255,255,255,0.015)]">
          <div className="text-[10px] font-extrabold text-[var(--text3)] tracking-[1.5px] uppercase mb-[10px]">Quy tắc cảnh báo Ads / Doanh số</div>
          <div className="flex gap-[18px]">
            <div className="flex items-center gap-[6px] text-[10.5px] font-bold text-[var(--text3)]">
              <span className="text-[var(--G)] text-[12px]">●</span> &lt; 30% — An toàn
            </div>
            <div className="flex items-center gap-[6px] text-[10.5px] font-bold text-[var(--text3)]">
              <span className="text-[var(--Y)] text-[12px]">●</span> 30–45% — Cần chú ý
            </div>
            <div className="flex items-center gap-[6px] text-[10.5px] font-bold text-[var(--text3)]">
              <span className="text-[var(--R)] text-[12px]">●</span> &gt; 45% — Nguy hiểm — Đốt tiền
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
};
