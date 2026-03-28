import React from 'react';

interface ReportData {
  date?: string;
  day?: string;
  week?: string;
  month?: string;
  endDate?: string;
  marketingExpenses?: number;
  me?: number; // Some use 'me' instead of 'marketingExpenses'
  impression: number;
  cpm: number;
  comments: number;
  commentsPerImp: number;
  costPerComment: number;
  newMessages: number;
  newMessagesPerImp: number;
  costPerNewMessage: number;
  sales: number;
  salesPerImp: number;
  costPerSale: number;
}

interface ReportTableProps {
  title: string;
  data: ReportData[];
  totals: any; // Generic totals object
  formatCurrency: (val: number) => string;
  avgCpm: number;
  avgCommentsPerImp: number;
  avgCostPerComment: number;
  avgNewMessagesPerImp: number;
  avgCostPerNewMessage: number;
  avgSalesPerImp: number;
  avgCostPerSale: number;
  type: 'daily' | 'weekly' | 'monthly';
}

export const ReportTable: React.FC<ReportTableProps> = ({
  title,
  data,
  totals,
  formatCurrency,
  avgCpm,
  avgCommentsPerImp,
  avgCostPerComment,
  avgNewMessagesPerImp,
  avgCostPerNewMessage,
  avgSalesPerImp,
  avgCostPerSale,
  type
}) => {
  const isMarketingExpenseLabel = (val: number | undefined) => val !== undefined;

  return (
    <div className="bg-ads-card rounded-xl overflow-hidden mb-8 border border-emerald-900/20 shadow-xl">
      <div className="p-4 border-b border-gray-700 bg-ads-sidebar/50">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          {title}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="p-2 border border-gray-700 bg-ads-table-header font-bold text-left sticky left-0 z-10">TỔNG</th>
              {data.map((item, idx) => (
                <th key={idx} className="p-2 border border-gray-700 bg-ads-table-header font-bold text-center min-w-[80px]">
                  {type === 'daily' && (
                    <>
                      <div>{item.date}</div>
                      <div className="text-xs text-gray-400">{item.day}</div>
                    </>
                  )}
                  {type === 'weekly' && (
                    <>
                      <div className="text-xs">{item.endDate}</div>
                      <div className="text-xs text-gray-400 whitespace-pre-line">{item.week}</div>
                    </>
                  )}
                  {type === 'monthly' && (
                    <>
                      <div className="text-xs">{item.endDate}</div>
                      <div className="text-xs text-gray-400">{item.month}</div>
                    </>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Marketing Report Section */}
            <tr className="bg-gray-800/50">
              <td colSpan={data.length + 2} className="p-2 border border-gray-700 font-bold text-white sticky left-0 z-10">Marketing Report</td>
            </tr>
            <tr>
              <td className="p-2 border border-gray-700 text-white font-medium sticky left-0 z-10 bg-ads-card">
                {type === 'daily' ? 'Marketing Expenses' : 'ME'}
              </td>
              <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">
                {formatCurrency(totals.marketingExpenses || totals.me)}
              </td>
              {data.map((item, idx) => (
                <td key={idx} className="p-2 border border-gray-700 text-right text-gray-300">
                  {formatCurrency(item.marketingExpenses ?? item.me ?? 0)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-2 border border-gray-700 text-white font-medium sticky left-0 z-10 bg-ads-card">Impression</td>
              <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{formatCurrency(totals.impression)}</td>
              {data.map((item, idx) => (
                <td key={idx} className="p-2 border border-gray-700 text-right text-gray-300">{formatCurrency(item.impression)}</td>
              ))}
            </tr>
            <tr>
              <td className="p-2 border border-gray-700 text-white font-medium sticky left-0 z-10 bg-ads-card">CPM</td>
              <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{formatCurrency(Math.round(avgCpm))}</td>
              {data.map((item, idx) => (
                <td key={idx} className="p-2 border border-gray-700 text-right text-gray-300">{item.cpm > 0 ? formatCurrency(item.cpm) : '0'}</td>
              ))}
            </tr>

            {/* Comments Report Section */}
            <tr className="bg-orange-900/30">
              <td colSpan={data.length + 2} className="p-2 border border-gray-700 font-bold text-white sticky left-0 z-10">Comments Report</td>
            </tr>
            <tr>
              <td className="p-2 border border-gray-700 text-white font-medium sticky left-0 z-10 bg-ads-card">Total comments</td>
              <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{formatCurrency(totals.comments)}</td>
              {data.map((item, idx) => (
                <td key={idx} className="p-2 border border-gray-700 text-right text-gray-300">{formatCurrency(item.comments)}</td>
              ))}
            </tr>
            <tr>
              <td className="p-2 border border-gray-700 text-white font-medium sticky left-0 z-10 bg-ads-card">Comments/Impression, %</td>
              <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold text-green-400">
                {avgCommentsPerImp.toFixed(2).replace('.', ',')}%
              </td>
              {data.map((item, idx) => (
                <td key={idx} className={`p-2 border border-gray-700 text-right ${item.commentsPerImp > 0 ? 'text-green-400' : 'text-gray-300'}`}>
                  {item.commentsPerImp > 0 ? `${item.commentsPerImp.toFixed(2).replace('.', ',')}%` : '0%'}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-2 border border-gray-700 text-white font-medium sticky left-0 z-10 bg-ads-card">Cost per comment</td>
              <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{formatCurrency(Math.round(avgCostPerComment))}</td>
              {data.map((item, idx) => (
                <td key={idx} className="p-2 border border-gray-700 text-right text-gray-300">
                  {item.costPerComment > 0 ? formatCurrency(item.costPerComment) : (type === 'daily' ? '0' : '')}
                </td>
              ))}
            </tr>

            {/* New Messages Report Section */}
            <tr className="bg-gray-800/50">
              <td colSpan={data.length + 2} className="p-2 border border-gray-700 font-bold text-white sticky left-0 z-10">New Messages Report</td>
            </tr>
            <tr>
              <td className="p-2 border border-gray-700 text-white font-medium sticky left-0 z-10 bg-ads-card">Total new messages</td>
              <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{formatCurrency(totals.newMessages)}</td>
              {data.map((item, idx) => (
                <td key={idx} className="p-2 border border-gray-700 text-right text-gray-300">{formatCurrency(item.newMessages)}</td>
              ))}
            </tr>
            <tr>
              <td className="p-2 border border-gray-700 text-white font-medium sticky left-0 z-10 bg-ads-card">New messages/Impression, %</td>
              <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold text-green-400">
                {avgNewMessagesPerImp.toFixed(2).replace('.', ',')}%
              </td>
              {data.map((item, idx) => (
                <td key={idx} className={`p-2 border border-gray-700 text-right ${item.newMessagesPerImp > 0 ? 'text-green-400' : 'text-gray-300'}`}>
                  {item.newMessagesPerImp > 0 ? `${item.newMessagesPerImp.toFixed(2).replace('.', ',')}%` : '0%'}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-2 border border-gray-700 text-white font-medium sticky left-0 z-10 bg-ads-card">Cost per new message</td>
              <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{formatCurrency(Math.round(avgCostPerNewMessage))}</td>
              {data.map((item, idx) => (
                <td key={idx} className="p-2 border border-gray-700 text-right text-gray-300">
                  {item.costPerNewMessage > 0 ? formatCurrency(item.costPerNewMessage) : (type === 'daily' ? '0' : '')}
                </td>
              ))}
            </tr>

            {/* Sales Report Section */}
            <tr className="bg-gray-800/50">
              <td colSpan={data.length + 2} className="p-2 border border-gray-700 font-bold text-white sticky left-0 z-10">Sales Report</td>
            </tr>
            <tr>
              <td className="p-2 border border-gray-700 text-white font-medium sticky left-0 z-10 bg-ads-card">Total sales</td>
              <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{formatCurrency(totals.sales)}</td>
              {data.map((item, idx) => (
                <td key={idx} className="p-2 border border-gray-700 text-right text-gray-300">{formatCurrency(item.sales)}</td>
              ))}
            </tr>
            <tr>
              <td className="p-2 border border-gray-700 text-white font-medium sticky left-0 z-10 bg-ads-card">Sales/Impression, %</td>
              <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">
                {avgSalesPerImp.toFixed(4).replace('.', ',')}%
              </td>
              {data.map((item, idx) => {
                const color = item.salesPerImp > 0.01 ? 'text-green-400' : item.salesPerImp === 0 ? 'text-red-400' : 'text-red-400';
                return (
                  <td key={idx} className={`p-2 border border-gray-700 text-right ${color}`}>
                    {item.salesPerImp > 0 ? `${item.salesPerImp.toFixed(4).replace('.', ',')}%` : (type === 'daily' ? '0.0000%' : '0%')}
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className="p-2 border border-gray-700 text-white font-medium sticky left-0 z-10 bg-ads-card">Cost per sale</td>
              <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{formatCurrency(Math.round(avgCostPerSale))}</td>
              {data.map((item, idx) => (
                <td key={idx} className="p-2 border border-gray-700 text-right text-gray-300">
                  {item.costPerSale > 0 ? formatCurrency(item.costPerSale) : (type === 'daily' ? '0' : '')}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
