import React from 'react';
import { KpiCard } from '../../../components/crm-dashboard/atoms/KpiCard';
import { SectionCard, Badge, AlertItem, BarRow } from '../../../components/crm-dashboard/atoms/SharedAtoms';

export const AdminDashboardView: React.FC = () => {
  return (
    <div className="dash-fade-up">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-[10px] mb-[14px]">
        <KpiCard 
          label="Tổng DT toàn hệ thống" 
          value="2.840.000.000" 
          sub="VNĐ · Tháng 03/2025" 
          delta="+12.4% tháng trước" 
          deltaType="up" 
          icon="💰" 
          barColor="linear-gradient(90deg, var(--accent), #5b4dff)" 
          animationDelay={0.03}
          valueSize="lg"
        />
        <KpiCard 
          label="Tổng chi phí Ads khai báo" 
          value="680.000.000" 
          sub="Ads/DT: 23.9%" 
          delta="Trong ngưỡng an toàn" 
          deltaType="nt" 
          icon="📢" 
          barColor="linear-gradient(90deg, var(--R), #f97316)" 
          animationDelay={0.06}
          valueSize="lg"
        />
        <KpiCard 
          label="Ngân sách đã nạp (Agency)" 
          value="920.000.000" 
          sub="Dư: 240M · 4 agency" 
          delta="Chênh lệch 26%" 
          deltaType="nt" 
          icon="🏦" 
          barColor="linear-gradient(90deg, var(--G), #06b6d4)" 
          animationDelay={0.09}
          valueSize="lg"
        />
        <KpiCard 
          label="Tổng lead / Chốt đơn" 
          value="8.420 / 2.105" 
          sub="Tỷ lệ chốt: 25.0%" 
          delta="AOV: 1.348.000đ" 
          deltaType="up" 
          icon="👥" 
          barColor="linear-gradient(90deg, var(--P), #ec4899)" 
          animationDelay={0.12}
          valueSize="lg"
        />
        <KpiCard 
          label="Đốt tiền / Cảnh báo" 
          value="3" 
          sub="Marketing ngưỡng đỏ" 
          delta="Cần xử lý ngay" 
          deltaType="dn" 
          icon="🔥" 
          barColor="linear-gradient(90deg, var(--Y), var(--R))" 
          animationDelay={0.15}
          valueColor="var(--R)"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-[14px] items-stretch mb-[14px]">
        <div className="lg:col-span-2 flex">
          <SectionCard 
            className="flex-1"
            title="📊 Hiệu suất Marketing — Toàn hệ thống" 
            subtitle="Tháng 03/2025 · 14 marketing · Sắp xếp doanh số"
            actions={<button className="btn-ghost py-[4.5px] px-[10px] text-[10.5px] rounded-[6px] flex items-center gap-[5px] bg-[rgba(255,255,255,0.05)] text-[var(--text2)] border-[var(--border)]"><span className="opacity-60 text-[12px]">⬇</span> Export</button>}
            bodyPadding={false}
          >
            <div className="overflow-x-auto h-full">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[9px] font-bold tracking-[1px] uppercase text-[var(--text3)] text-left">
                    <th className="p-[7px_12px] text-center">#</th>
                    <th className="p-[7px_12px]">Marketing</th>
                    <th className="p-[7px_12px] text-right">Doanh số</th>
                    <th className="p-[7px_12px] text-right">Chi phí</th>
                    <th className="p-[7px_12px] text-right">Ads/DT</th>
                    <th className="p-[7px_12px] text-right">CPL</th>
                    <th className="p-[7px_12px] text-right">CPO</th>
                    <th className="p-[7px_12px] text-right">Chốt%</th>
                    <th className="p-[7px_12px]">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="text-[11.5px] text-[var(--text2)]">
                  {/* Row 1 */}
                  <tr className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.018)] transition-colors">
                    <td className="p-[9px_12px] text-center font-[var(--mono)] text-[var(--gold)] font-extrabold text-[12.5px]">1</td>
                    <td className="p-[9px_12px]">
                      <div className="font-bold text-[var(--text)] text-[11.5px]">Nguyễn Thị Lan</div>
                      <div className="text-[10px] text-[var(--text3)] mt-[1.5px]">Team A · BIOKAMA</div>
                    </td>
                    <td className="p-[9px_12px] text-right font-[var(--mono)] text-[var(--G)] font-extrabold text-[11px]">342M</td>
                    <td className="p-[9px_12px] text-right font-[var(--mono)] text-[11px] text-[var(--text2)]">52M</td>
                    <td className="p-[9px_12px] text-right"><span className="bg-[rgba(15,168,109,0.12)] text-[var(--G)] p-[2.5px_7.5px] rounded-[4px] text-[9.5px] font-bold">15.2%</span></td>
                    <td className="p-[9px_12px] text-right font-[var(--mono)] text-[11px]">42k</td>
                    <td className="p-[9px_12px] text-right font-[var(--mono)] text-[11px]">156k</td>
                    <td className="p-[9px_12px] text-right font-[var(--mono)] text-[var(--G)] text-[11px] font-bold">31%</td>
                    <td className="p-[9px_12px]"><span className="bg-[rgba(15,168,109,0.12)] text-[var(--G)] p-[2.5px_7.5px] rounded-[4px] text-[9.5px] font-bold flex items-center gap-[4px] w-fit">● Tốt</span></td>
                  </tr>

                  {/* Row 2 */}
                  <tr className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.018)] transition-colors">
                    <td className="p-[9px_12px] text-center font-[var(--mono)] font-extrabold text-[var(--text3)]">2</td>
                    <td className="p-[9px_12px]">
                      <div className="font-bold text-[var(--text)] text-[11.5px]">Trần Văn Minh</div>
                      <div className="text-[10px] text-[var(--text3)] mt-[1.5px]">Team B · BIOKAMA</div>
                    </td>
                    <td className="p-[9px_12px] text-right font-[var(--mono)] text-[var(--text)] font-bold text-[11px]">298M</td>
                    <td className="p-[9px_12px] text-right font-[var(--mono)] text-[11px]">61M</td>
                    <td className="p-[9px_12px] text-right"><span className="bg-[rgba(15,168,109,0.12)] text-[var(--G)] p-[2.5px_7.5px] rounded-[4px] text-[9.5px] font-bold">20.5%</span></td>
                    <td className="p-[9px_12px] text-right font-[var(--mono)] text-[11px]">62k</td>
                    <td className="p-[9px_12px] text-right font-[var(--mono)] text-[11px]">230k</td>
                    <td className="p-[9px_12px] text-right font-[var(--mono)] text-[var(--B)] text-[11px] font-bold">27%</td>
                    <td className="p-[9px_12px]"><span className="bg-[rgba(91,77,255,0.15)] text-[var(--B)] p-[2.5px_7.5px] rounded-[4px] text-[9.5px] font-bold flex items-center gap-[4px] w-fit">● Khá</span></td>
                  </tr>

                  {/* Row 3 */}
                  <tr className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.018)] transition-colors">
                    <td className="p-[9px_12px] text-center font-[var(--mono)] font-extrabold text-[var(--text3)]">3</td>
                    <td className="p-[9px_12px]">
                      <div className="font-bold text-[var(--text)] text-[11.5px]">Lê Thị Hoa</div>
                      <div className="text-[10px] text-[var(--text3)] mt-[1.5px]">Team A · FABCO</div>
                    </td>
                    <td className="p-[9px_12px] text-right font-[var(--mono)] text-[var(--text)] font-bold text-[11px]">215M</td>
                    <td className="p-[9px_12px] text-right font-[var(--mono)] text-[11px]">48M</td>
                    <td className="p-[9px_12px] text-right"><span className="bg-[rgba(15,168,109,0.12)] text-[var(--G)] p-[2.5px_7.5px] rounded-[4px] text-[9.5px] font-bold">22.3%</span></td>
                    <td className="p-[9px_12px] text-right font-[var(--mono)] text-[11px]">57k</td>
                    <td className="p-[9px_12px] text-right font-[var(--mono)] text-[11px]">249k</td>
                    <td className="p-[9px_12px] text-right font-[var(--mono)] text-[var(--B)] text-[11px] font-bold">23%</td>
                    <td className="p-[9px_12px]"><span className="bg-[rgba(91,77,255,0.15)] text-[var(--B)] p-[2.5px_7.5px] rounded-[4px] text-[9.5px] font-bold flex items-center gap-[4px] w-fit">● Khá</span></td>
                  </tr>

                  {/* Row Alert 1 */}
                  <tr className="border-b border-[rgba(224,61,61,0.08)] bg-[rgba(224,61,61,0.02)] hover:bg-[rgba(224,61,61,0.04)] transition-colors">
                    <td className="p-[9px_12px] text-center text-[var(--R)] animate-pulse">!</td>
                    <td className="p-[9px_12px]">
                      <div className="font-bold text-[var(--R)] text-[11.5px]">MKT A</div>
                      <div className="text-[10px] text-[var(--text3)] mt-[1.5px]">Team C · BIOKAMA</div>
                    </td>
                    <td className="p-[9px_12px] text-right font-[var(--mono)] text-[var(--Y)] font-bold text-[11px]">8.9M</td>
                    <td className="p-[9px_12px] text-right font-[var(--mono)] text-[var(--Y)] text-[11px]">5.2M</td>
                    <td className="p-[9px_12px] text-right"><span className="bg-[rgba(224,61,61,0.15)] text-[var(--R)] p-[2.5px_7.5px] rounded-[4px] text-[9.5px] font-bold">58%</span></td>
                    <td className="p-[9px_12px] text-right font-[var(--mono)] text-[11px]">84k</td>
                    <td className="p-[9px_12px] text-right font-[var(--mono)] text-[11px]">473k</td>
                    <td className="p-[9px_12px] text-right font-[var(--mono)] text-[var(--Y)] text-[11px] font-bold">17.7%</td>
                    <td className="p-[9px_12px]"><span className="bg-[rgba(224,61,61,0.15)] text-[var(--R)] p-[2.5px_7.5px] rounded-[4px] text-[9.5px] font-bold flex items-center gap-[4px] w-fit">● Đắt tiền</span></td>
                  </tr>

                  {/* Row Alert 2 */}
                  <tr className="border-b border-[rgba(224,61,61,0.08)] bg-[rgba(224,61,61,0.02)] hover:bg-[rgba(224,61,61,0.04)] transition-colors">
                    <td className="p-[9px_12px] text-center text-[var(--R)] animate-pulse">!</td>
                    <td className="p-[9px_12px]">
                      <div className="font-bold text-[var(--R)] text-[11.5px]">MKT C</div>
                      <div className="text-[10px] text-[var(--text3)] mt-[1.5px]">Team B · MASSHU</div>
                    </td>
                    <td className="p-[9px_12px] text-right font-[var(--mono)] text-[var(--Y)] font-bold text-[11px]">7.0M</td>
                    <td className="p-[9px_12px] text-right font-[var(--mono)] text-[var(--Y)] text-[11px]">4.8M</td>
                    <td className="p-[9px_12px] text-right"><span className="bg-[rgba(224,61,61,0.15)] text-[var(--R)] p-[2.5px_7.5px] rounded-[4px] text-[9.5px] font-bold">69%</span></td>
                    <td className="p-[9px_12px] text-right font-[var(--mono)] text-[11px]">120k</td>
                    <td className="p-[9px_12px] text-right font-[var(--mono)] text-[11px]">600k</td>
                    <td className="p-[9px_12px] text-right font-[var(--mono)] text-[var(--Y)] text-[11px] font-bold">20%</td>
                    <td className="p-[9px_12px]"><span className="bg-[rgba(224,61,61,0.15)] text-[var(--R)] p-[2.5px_7.5px] rounded-[4px] text-[9.5px] font-bold flex items-center gap-[4px] w-fit">● Đắt tiền</span></td>
                  </tr>

                  {/* Row 4 */}
                  <tr className="hover:bg-[rgba(255,255,255,0.018)] transition-colors">
                    <td className="p-[9px_12px] text-center font-[var(--mono)] font-extrabold text-[var(--text3)]">4</td>
                    <td className="p-[9px_12px]">
                      <div className="font-bold text-[var(--text)] text-[11.5px]">MKT B</div>
                      <div className="text-[10px] text-[var(--text3)] mt-[1.5px]">Team A · BIOKAMA</div>
                    </td>
                    <td className="p-[9px_12px] text-right font-[var(--mono)] text-[var(--text)] font-bold text-[11px]">18.5M</td>
                    <td className="p-[9px_12px] text-right font-[var(--mono)] text-[11px]">3.1M</td>
                    <td className="p-[9px_12px] text-right"><span className="bg-[rgba(15,168,109,0.12)] text-[var(--G)] p-[2.5px_7.5px] rounded-[4px] text-[9.5px] font-bold">29.5%</span></td>
                    <td className="p-[9px_12px] text-right font-[var(--mono)] text-[11px]">41k</td>
                    <td className="p-[9px_12px] text-right font-[var(--mono)] text-[11px]">163k</td>
                    <td className="p-[9px_12px] text-right font-[var(--mono)] text-[var(--G)] text-[11px] font-bold">25.3%</td>
                    <td className="p-[9px_12px]"><span className="bg-[rgba(15,168,109,0.12)] text-[var(--G)] p-[2.5px_7.5px] rounded-[4px] text-[9.5px] font-bold flex items-center gap-[4px] w-fit">● Tốt</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

        <div className="flex flex-col gap-[14px]">
          <SectionCard 
            title="🚨 Cảnh báo cần xử lý" 
            badge={{ text: '7 mới', type: 'R' }}
          >
            <div className="flex flex-col gap-[7px]">
              <AlertItem 
                title="MKT A — Ads/DT 58%" 
                description="Vượt ngưỡng đỏ 45% · Burn Score: 78" 
                statusText="Nguy hiểm" 
                statusType="R" 
              />
              <AlertItem 
                title="MKT C — Ads/DT 69%" 
                description="Kiểm tra content + target · Burn: 84" 
                statusText="Nguy hiểm" 
                statusType="R" 
              />
              <AlertItem 
                title="2 MKT chưa nhập báo cáo" 
                description="Deadline 22:00 · Còn 4 tiếng" 
                statusText="Nhắc nhở" 
                statusType="Y" 
              />
              <AlertItem 
                title="TK-004 chưa gắn agency" 
                description="ID #4812 · BIOKAMA · Thiếu thiết lập" 
                statusText="Cần làm" 
                statusType="Y" 
              />
            </div>
          </SectionCard>

          <SectionCard 
            title="💰 Duyệt ngân sách" 
            badge={{ text: '3 chờ', type: 'Y' }}
          >
            <div className="flex flex-col gap-[8px]">
              {/* Item 1 */}
              <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] hover:border-[var(--border2)] rounded-[10px] p-[10px_14px] flex items-center gap-[12px] transition-all duration-200 group">
                <div className="flex-1">
                  <div className="text-[11.5px] font-bold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">Team A — Media One</div>
                  <div className="text-[9.5px] text-[var(--text3)] mt-[2.5px]">BIOKAMA · TK-001,002,003 · 25/03</div>
                </div>
                <div className="font-[var(--mono)] text-[12.5px] font-bold text-[var(--Y)] drop-shadow-[0_0_8px_rgba(232,160,32,0.2)]">150M</div>
                <div className="flex gap-[6px]">
                  <button className="h-[26px] p-[0_10px] text-[10px] rounded-[6px] bg-[rgba(15,168,109,0.15)] text-[var(--G)] font-bold hover:bg-[var(--G)] hover:text-[#fff] transition-all border border-[rgba(15,168,109,0.2)]">✓ Duyệt</button>
                  <button className="h-[26px] w-[26px] flex items-center justify-center text-[10px] rounded-[6px] bg-[rgba(224,61,61,0.12)] text-[var(--R)] hover:bg-[var(--R)] hover:text-[#fff] transition-all border border-[rgba(224,61,61,0.2)]">✕</button>
                </div>
              </div>

              {/* Item 2 */}
              <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] hover:border-[var(--border2)] rounded-[10px] p-[10px_14px] flex items-center gap-[12px] transition-all duration-200 group">
                <div className="flex-1">
                  <div className="text-[11.5px] font-bold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">Team B — AdsViet</div>
                  <div className="text-[9.5px] text-[var(--text3)] mt-[2.5px]">FABCO · TK-005,006 · 24/03</div>
                </div>
                <div className="font-[var(--mono)] text-[12.5px] font-bold text-[var(--Y)] drop-shadow-[0_0_8px_rgba(232,160,32,0.2)]">80M</div>
                <div className="flex gap-[6px]">
                  <button className="h-[26px] p-[0_10px] text-[10px] rounded-[6px] bg-[rgba(15,168,109,0.15)] text-[var(--G)] font-bold hover:bg-[var(--G)] hover:text-[#fff] transition-all border border-[rgba(15,168,109,0.2)]">✓ Duyệt</button>
                  <button className="h-[26px] w-[26px] flex items-center justify-center text-[10px] rounded-[6px] bg-[rgba(224,61,61,0.12)] text-[var(--R)] hover:bg-[var(--R)] hover:text-[#fff] transition-all border border-[rgba(224,61,61,0.2)]">✕</button>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      <SectionCard title="⚖️ Đối chiếu 3 lớp — Tổng quan tháng 03/2025" actions={<button className="btn-ghost text-[11px] rounded-[6px] py-[4px] px-[12px]">Xem chi tiết</button>}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[24px]">
          <div>
            <div className="text-[9.5px] font-extrabold tracking-[1px] uppercase text-[var(--text3)] mb-[12px]">Lớp 1 — Nạp vs Khai báo</div>
            <BarRow label="Đã nạp (Agency)" value="920M" widthPercent={100} color="var(--accent)" />
            <BarRow label="MKT khai báo chi" value="680M" widthPercent={74} color="var(--G)" />
            <BarRow label="Chênh lệch dư" value="240M" widthPercent={26} color="var(--Y)" />
          </div>
          <div>
            <div className="text-[9.5px] font-extrabold tracking-[1px] uppercase text-[var(--text3)] mb-[12px]">Lớp 2 — Khai báo vs API</div>
            <BarRow label="MKT khai báo" value="680M" widthPercent={100} color="var(--accent)" />
            <BarRow label="Meta API thực tế" value="659M" widthPercent={97} color="var(--G)" />
            <BarRow label="Sai lệch" value="3.1%" widthPercent={3} color="var(--Y)" />
          </div>
          <div>
            <div className="text-[9.5px] font-extrabold tracking-[1px] uppercase text-[var(--text3)] mb-[12px]">Lớp 3 — Lead / Đơn / DT (CRM)</div>
            <BarRow label="Tổng lead" value="8.420" widthPercent={100} color="var(--P)" />
            <BarRow label="Đơn chốt" value="2.105" widthPercent={25} color="var(--G)" />
            <BarRow label="Tỷ lệ chốt TB" value="25.0%" widthPercent={25} color="var(--accent)" />
          </div>
        </div>
      </SectionCard>
    </div>
  );
};
