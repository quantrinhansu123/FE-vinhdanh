import React from 'react';
import { SectionCard, HeatCell, Badge } from '../../../components/crm-dashboard/atoms/SharedAtoms';

export const HeatmapView: React.FC = () => {
  return (
    <div className="dash-fade-up">
      <SectionCard title="🌡️ Heatmap Ads/DT — 7 ngày × 5 Marketing" subtitle="Xanh < 30% · Vàng 30-45% · Đỏ > 45%" bodyPadding={false}>
        <div className="p-[14px_16px] overflow-x-auto">
          <table className="w-full border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-[var(--border)] text-[9px] font-bold tracking-[1px] uppercase text-[var(--text3)]">
                <th className="p-[7px_12px] text-left">Marketing</th>
                <th className="p-[7px_12px] text-center">19/3</th>
                <th className="p-[7px_12px] text-center">20/3</th>
                <th className="p-[7px_12px] text-center">21/3</th>
                <th className="p-[7px_12px] text-center">22/3</th>
                <th className="p-[7px_12px] text-center">23/3</th>
                <th className="p-[7px_12px] text-center">24/3</th>
                <th className="p-[7px_12px] text-center">25/3</th>
                <th className="p-[7px_12px] text-right">TB 7 ngày</th>
              </tr>
            </thead>
            <tbody className="text-[var(--text2)]">
              {/* Nguyễn Thị Lan */}
              <tr className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.01)] transition-colors">
                <td className="p-[9px_12px]"><div className="font-bold text-[var(--text)]">Nguyễn Thị Lan</div></td>
                <td className="p-[9px_12px] text-center"><HeatCell value="14.2" type="G" /></td>
                <td className="p-[9px_12px] text-center"><HeatCell value="16.8" type="G" /></td>
                <td className="p-[9px_12px] text-center"><HeatCell value="15.1" type="G" /></td>
                <td className="p-[9px_12px] text-center"><HeatCell value="13.9" type="G" /></td>
                <td className="p-[9px_12px] text-center"><HeatCell value="17.2" type="G" /></td>
                <td className="p-[9px_12px] text-center"><HeatCell value="14.5" type="G" /></td>
                <td className="p-[9px_12px] text-center"><HeatCell value="15.2" type="G" /></td>
                <td className="p-[9px_12px] text-right"><HeatCell value="15.3%" type="G" /></td>
              </tr>
              {/* Trần Văn Minh */}
              <tr className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.01)] transition-colors">
                <td className="p-[9px_12px]"><div className="font-bold text-[var(--text)]">Trần Văn Minh</div></td>
                <td className="p-[9px_12px] text-center"><HeatCell value="18.6" type="G" /></td>
                <td className="p-[9px_12px] text-center"><HeatCell value="22.1" type="G" /></td>
                <td className="p-[9px_12px] text-center"><HeatCell value="26.3" type="G" /></td>
                <td className="p-[9px_12px] text-center"><HeatCell value="19.8" type="G" /></td>
                <td className="p-[9px_12px] text-center"><HeatCell value="21.6" type="G" /></td>
                <td className="p-[9px_12px] text-center"><HeatCell value="35.0" type="Y" /></td>
                <td className="p-[9px_12px] text-center"><HeatCell value="20.5" type="G" /></td>
                <td className="p-[9px_12px] text-right"><HeatCell value="22.0%" type="G" /></td>
              </tr>
              {/* Phạm Quốc Hùng */}
              <tr className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.01)] transition-colors">
                <td className="p-[9px_12px]"><div className="font-bold text-[var(--text)]">Phạm Quốc Hùng</div></td>
                <td className="p-[9px_12px] text-center"><HeatCell value="42.1" type="R" /></td>
                <td className="p-[9px_12px] text-center"><HeatCell value="48.3" type="R" /></td>
                <td className="p-[9px_12px] text-center"><HeatCell value="51.2" type="R" /></td>
                <td className="p-[9px_12px] text-center"><HeatCell value="45.8" type="R" /></td>
                <td className="p-[9px_12px] text-center"><HeatCell value="56.6" type="R" /></td>
                <td className="p-[9px_12px] text-center"><HeatCell value="49.2" type="R" /></td>
                <td className="p-[9px_12px] text-center"><HeatCell value="52.6" type="R" /></td>
                <td className="p-[9px_12px] text-right"><HeatCell value="49.4%" type="R" /></td>
              </tr>
              {/* MKT A */}
              <tr className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.01)] transition-colors">
                <td className="p-[9px_12px]"><div className="font-bold text-[var(--text)]">MKT A</div></td>
                <td className="p-[9px_12px] text-center"><HeatCell value="55.2" type="R" /></td>
                <td className="p-[9px_12px] text-center"><HeatCell value="61.4" type="R" /></td>
                <td className="p-[9px_12px] text-center"><HeatCell value="58.8" type="R" /></td>
                <td className="p-[9px_12px] text-center"><HeatCell value="62.1" type="R" /></td>
                <td className="p-[9px_12px] text-center"><HeatCell value="57.3" type="R" /></td>
                <td className="p-[9px_12px] text-center"><HeatCell value="59.8" type="R" /></td>
                <td className="p-[9px_12px] text-center"><HeatCell value="58.0" type="R" /></td>
                <td className="p-[9px_12px] text-right"><HeatCell value="59.0%" type="R" /></td>
              </tr>
              {/* MKT B */}
              <tr className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.01)] transition-colors">
                <td className="p-[9px_12px]"><div className="font-bold text-[var(--text)]">MKT B</div></td>
                <td className="p-[9px_12px] text-center"><HeatCell value="28.4" type="G" /></td>
                <td className="p-[9px_12px] text-center"><HeatCell value="31.2" type="Y" /></td>
                <td className="p-[9px_12px] text-center"><HeatCell value="27.8" type="G" /></td>
                <td className="p-[9px_12px] text-center"><HeatCell value="30.1" type="Y" /></td>
                <td className="p-[9px_12px] text-center"><HeatCell value="39.4" type="Y" /></td>
                <td className="p-[9px_12px] text-center"><HeatCell value="28.6" type="G" /></td>
                <td className="p-[9px_12px] text-center"><HeatCell value="29.5" type="G" /></td>
                <td className="p-[9px_12px] text-right"><HeatCell value="30.7%" type="Y" /></td>
              </tr>
            </tbody>
          </table>
          <div className="mt-[12px] flex flex-wrap gap-[14px] border-t border-[var(--border)] pt-[12px]">
            <div className="flex items-center gap-[5px]">
              <div className="w-[18px] h-[18px] rounded-[4px] bg-[var(--Gd)] text-[var(--G)] text-[9px] font-black flex items-center justify-center">OK</div>
              <span className="text-[10px] text-[var(--text3)]">&lt; 30% — Tốt</span>
            </div>
            <div className="flex items-center gap-[5px]">
              <div className="w-[18px] h-[18px] rounded-[4px] bg-[var(--Yd)] text-[var(--Y)] text-[9px] font-black flex items-center justify-center">!</div>
              <span className="text-[10px] text-[var(--text3)]">30-45% — Chú ý</span>
            </div>
            <div className="flex items-center gap-[5px]">
              <div className="w-[18px] h-[18px] rounded-[4px] bg-[var(--Rd)] text-[var(--R)] text-[9px] font-black flex items-center justify-center">⭕</div>
              <span className="text-[10px] text-[var(--text3)]">&gt; 45% — Nguy hiểm</span>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
};
