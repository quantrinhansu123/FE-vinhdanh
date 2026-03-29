import React from 'react';
import { SectionCard, BarRow } from '../../../components/crm-dashboard/atoms/SharedAtoms';

export const ReconcileView: React.FC = () => {
  return (
    <div className="dash-fade-up">
      <SectionCard title="⚖️ Đối chiếu 3 lớp chi tiết — Số liệu Realtime">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[24px]">
          <div>
            <div className="text-[10px] font-extrabold text-[var(--accent)] tracking-[1px] uppercase mb-[10px] pb-[8px] border-b border-[var(--border)]">
              🔵 LỚP 1 — NẠP VS KHAI BÁO
            </div>
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="text-left text-[var(--text3)] uppercase tracking-[0.5px]">
                  <th className="py-[6px]">Agency</th>
                  <th className="py-[6px] text-right">Nạp</th>
                  <th className="py-[6px] text-right">Khai báo</th>
                  <th className="py-[6px] text-right">Chênh</th>
                </tr>
              </thead>
              <tbody className="text-[var(--text2)]">
                <tr className="border-b border-[rgba(255,255,255,0.03)]"><td className="py-[6px]">Media One</td><td className="py-[6px] text-right">450M</td><td className="py-[6px] text-right">380M</td><td className="py-[6px] text-right text-[var(--Y)]">70M</td></tr>
                <tr className="border-b border-[rgba(255,255,255,0.03)]"><td className="py-[6px]">AdsViet</td><td className="py-[6px] text-right">280M</td><td className="py-[6px] text-right">200M</td><td className="py-[6px] text-right text-[var(--Y)]">80M</td></tr>
                <tr className="border-b border-[rgba(255,255,255,0.03)]"><td className="py-[6px]">DigiMedia</td><td className="py-[6px] text-right">190M</td><td className="py-[6px] text-right">100M</td><td className="py-[6px] text-right text-[var(--R)]">90M</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <div className="text-[10px] font-extrabold text-[var(--Y)] tracking-[1px] uppercase mb-[10px] pb-[8px] border-b border-[var(--border)]">
              🟡 LỚP 2 — KHAI BÁO VS API
            </div>
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="text-left text-[var(--text3)] uppercase tracking-[0.5px]">
                  <th className="py-[6px]">Marketing</th>
                  <th className="py-[6px] text-right">Khai báo</th>
                  <th className="py-[6px] text-right">API</th>
                  <th className="py-[6px] text-right">Sai lệch</th>
                </tr>
              </thead>
              <tbody className="text-[var(--text2)]">
                <tr className="border-b border-[rgba(255,255,255,0.03)]"><td className="py-[6px]">NTL</td><td className="py-[6px] text-right">52M</td><td className="py-[6px] text-right">50.8M</td><td className="py-[6px] text-right text-[var(--G)]">2.3%</td></tr>
                <tr className="border-b border-[rgba(255,255,255,0.03)]"><td className="py-[6px]">TVM</td><td className="py-[6px] text-right">61M</td><td className="py-[6px] text-right">59.5M</td><td className="py-[6px] text-right text-[var(--G)]">2.5%</td></tr>
                <tr className="border-b border-[rgba(255,255,255,0.03)]"><td className="py-[6px]">MKT A</td><td className="py-[6px] text-right">5.2M</td><td className="py-[6px] text-right">4.9M</td><td className="py-[6px] text-right text-[var(--Y)]">6.1%</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <div className="text-[10px] font-extrabold text-[var(--G)] tracking-[1px] uppercase mb-[10px] pb-[8px] border-b border-[var(--border)]">
              🟢 LỚP 3 — LEAD / ĐƠN / DT (CRM API)
            </div>
            <div className="text-[9.5px] text-[var(--Y)] italic mt-[6px] mb-[10px]">
              ⚠️ Marketing không được sửa tay — CRM trả về trực tiếp
            </div>
            <div className="mt-[10px]">
              <BarRow label="Lead tổng" value="8.420" widthPercent={100} color="var(--P)" />
              <BarRow label="Đơn chốt" value="2.105" widthPercent={25} color="var(--G)" />
              <BarRow label="Chưa chốt" value="6.315" widthPercent={75} color="var(--text3)" />
              <BarRow label="DT tổng" value="2.840M" widthPercent={100} color="var(--accent)" />
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
};
