import React from 'react';
import { SectionCard, Badge } from '../../../components/crm-dashboard/atoms/SharedAtoms';

export const MktHistoryView: React.FC = () => {
  const historyData = [
    {
      date: '25/03/2025',
      revenue: '12.4M',
      ads: '1.88M',
      adsRatio: '15.2%',
      lead: 42,
      orders: 11,
      lastEntry: '15:42',
      status: 'Chưa khóa',
      statusType: 'Y' as const
    },
    {
      date: '24/03/2025',
      revenue: '10.5M',
      ads: '1.72M',
      adsRatio: '16.4%',
      lead: 38,
      orders: 9,
      lastEntry: '21:55',
      status: 'Đã khóa',
      statusType: 'G' as const
    },
    {
      date: '23/03/2025',
      revenue: '14.2M',
      ads: '2.14M',
      adsRatio: '15.1%',
      lead: 51,
      orders: 14,
      lastEntry: '22:01',
      status: 'Đã khóa',
      statusType: 'G' as const
    },
    {
      date: '22/03/2025',
      revenue: '11.8M',
      ads: '1.64M',
      adsRatio: '13.9%',
      lead: 44,
      orders: 12,
      lastEntry: '21:48',
      status: 'Đã khóa',
      statusType: 'G' as const
    },
    {
      date: '21/03/2025',
      revenue: '9.2M',
      ads: '1.39M',
      adsRatio: '15.1%',
      lead: 32,
      orders: 7,
      lastEntry: '23:15',
      status: 'Đã khóa',
      statusType: 'G' as const
    }
  ];

  return (
    <div className="dash-fade-up">
      <SectionCard title="📅 Lịch sử báo cáo của tôi" bodyPadding={false}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] text-[10px] font-extrabold tracking-[1px] uppercase text-[var(--text3)] text-left">
                <th className="p-[12px_16px]">Ngày</th>
                <th className="p-[12px_16px] text-right">Doanh số</th>
                <th className="p-[12px_16px] text-right">Ads</th>
                <th className="p-[12px_16px] text-right">Ads/DT</th>
                <th className="p-[12px_16px] text-right">Lead</th>
                <th className="p-[12px_16px] text-right">Đơn</th>
                <th className="p-[12px_16px] text-center">Giờ nhập cuối</th>
                <th className="p-[12px_16px] text-right">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="text-[12.5px] text-[var(--text2)] font-[var(--mono)]">
              {historyData.map((row, idx) => (
                <tr key={idx} className="border-b border-[rgba(255,255,255,0.03)] transition-colors hover:bg-[rgba(255,255,255,0.02)] last:border-0 grow">
                  <td className="p-[14px_16px] text-[var(--text3)]">{row.date}</td>
                  <td className={`p-[14px_16px] text-right font-black ${idx === 0 ? 'text-[var(--G)]' : 'text-[var(--text)]'}`}>{row.revenue}</td>
                  <td className="p-[14px_16px] text-right">{row.ads}</td>
                  <td className="p-[14px_16px] text-right">
                    <Badge type={parseFloat(row.adsRatio) < 16 ? 'G' : 'Y'}>{row.adsRatio}</Badge>
                  </td>
                  <td className="p-[14px_16px] text-right">{row.lead}</td>
                  <td className="p-[14px_16px] text-right">{row.orders}</td>
                  <td className="p-[14px_16px] text-center text-[var(--text3)]">{row.lastEntry}</td>
                  <td className="p-[14px_16px] text-right">
                    <Badge type={row.statusType}>{row.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
};
