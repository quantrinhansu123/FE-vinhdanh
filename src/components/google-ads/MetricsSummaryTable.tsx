import React from 'react';
import { motion } from 'motion/react';
import { 
  User, 
  TrendingUp, 
  DollarSign, 
  ShoppingCart, 
  Target, 
  MessageCircle, 
  Percent, 
  BarChart3,
  CreditCard,
  Zap
} from 'lucide-react';

interface MetricsSummaryTableProps {
  data: any[];
  totals: any;
  formatCurrency: (val: number) => string;
}

export const MetricsSummaryTable: React.FC<MetricsSummaryTableProps> = ({
  data,
  totals,
  formatCurrency
}) => {
  const formatPercent = (val: number) => val.toFixed(2).replace('.', ',') + '%';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-ads-card/30 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl relative"
    >
      <div className="p-6 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-emerald-500/10 via-transparent to-transparent">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            Performance Metrics Summary
          </h3>
          <p className="text-sm text-gray-400 mt-1 font-medium">Detailed breakdown of advertising performance by employee</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex px-3 py-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-[10px] font-bold text-emerald-400 uppercase tracking-wider items-center gap-1.5">
            <Zap className="w-3 h-3 animate-pulse" />
            Updated just now
          </div>
          <div className="px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 cursor-help group/info relative">
            <Target className="w-3 h-3" />
            Performance Tiers
            <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-ads-card border border-white/10 rounded-lg opacity-0 pointer-events-none group-hover/info:opacity-100 transition-opacity text-[10px] lowercase normal-case text-gray-400 font-normal">
              Employees are ranked by total revenue contribution and ad efficiency.
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-sm border-separate border-spacing-0 min-w-[1200px]">
          <thead>
            <tr className="bg-white/5 text-gray-400 uppercase text-[10px] font-black tracking-[0.1em]">
              <th className="p-4 text-left border-b border-white/10 sticky left-0 z-20 bg-[#0a192f] backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-emerald-400" />
                  Employee Profile
                </div>
              </th>
              <th className="p-4 text-right border-b border-white/10">
                <div className="flex items-center justify-end gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                  Revenue
                </div>
              </th>
              <th className="p-4 text-right border-b border-white/10">
                <div className="flex items-center justify-end gap-2">
                  <DollarSign className="w-3.5 h-3.5 text-red-400" />
                  Expenses
                </div>
              </th>
              <th className="p-4 text-right border-b border-white/10">
                <div className="flex items-center justify-end gap-2 text-emerald-400">
                  <ShoppingCart className="w-3.5 h-3.5" />
                  Orders
                </div>
              </th>
              <th className="p-4 text-right border-b border-white/10">
                <div className="flex items-center justify-end gap-2 text-purple-400">
                  <Target className="w-3.5 h-3.5" />
                  Leads
                </div>
              </th>
              <th className="p-4 text-right border-b border-white/10 border-r border-white/5">
                <div className="flex items-center justify-end gap-2 text-cyan-400">
                  <MessageCircle className="w-3.5 h-3.5" />
                  Messages
                </div>
              </th>
              <th className="p-4 text-right border-b border-white/10 bg-yellow-400/5 text-yellow-400">
                <div className="flex items-center justify-end gap-2">
                  <Percent className="w-3.5 h-3.5" />
                  ACOS %
                </div>
              </th>
              <th className="p-4 text-right border-b border-white/10 bg-orange-400/5 text-orange-400">
                <div className="flex items-center justify-end gap-2">
                  <Zap className="w-3.5 h-3.5" />
                  Closing %
                </div>
              </th>
              <th className="p-4 text-right border-b border-white/10 bg-emerald-400/5 text-emerald-400 border-r border-white/5">
                <div className="flex items-center justify-end gap-2">
                  <Target className="w-3.5 h-3.5" />
                  Contact %
                </div>
              </th>
              <th className="p-4 text-right border-b border-white/10 text-gray-500 font-bold">Avg Order</th>
              <th className="p-4 text-right border-b border-white/10 text-gray-500 font-bold">CPO</th>
              <th className="p-4 text-right border-b border-white/10 text-gray-500 font-bold">CPL</th>
              <th className="p-4 text-right border-b border-white/10 text-gray-500 font-bold">CPM</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data.map((emp, idx) => {
              const isTop = idx === 0;
              return (
                <motion.tr 
                  key={idx} 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="group hover:bg-white/[0.03] transition-colors duration-150"
                >
                  <td className="p-4 font-bold text-white sticky left-0 z-10 bg-[#0a192f]/90 backdrop-blur-md group-hover:bg-[#1a2b45] transition-colors border-r border-white/5">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black relative ${isTop ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-black shadow-lg shadow-orange-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                        {emp.name.charAt(0)}
                        {isTop && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full flex items-center justify-center shadow-lg">
                            <span className="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm tracking-tight">{emp.name}</span>
                        {isTop && <span className="text-[10px] text-orange-400 font-black uppercase tracking-widest mt-0.5">Top Performer</span>}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-right font-bold text-emerald-400 tabular-nums">{formatCurrency(emp.revenue)}</td>
                  <td className="p-4 text-right text-gray-300 tabular-nums">{formatCurrency(emp.cost)}</td>
                  <td className="p-4 text-right font-black text-white tabular-nums">{emp.orders.toLocaleString()}</td>
                  <td className="p-4 text-right text-gray-300 tabular-nums">{emp.leads.toLocaleString()}</td>
                  <td className="p-4 text-right text-gray-300 border-r border-white/5 tabular-nums">{emp.messages.toLocaleString()}</td>
                  <td className="p-4 text-right font-black bg-yellow-400/5 text-yellow-400 tabular-nums">{formatPercent(emp.adCostPercent)}</td>
                  <td className="p-4 text-right font-black bg-orange-400/5 text-orange-400 tabular-nums">{formatPercent(emp.closingRate)}</td>
                  <td className="p-4 text-right font-black bg-emerald-400/5 text-emerald-400 border-r border-white/5 tabular-nums">{formatPercent(emp.contactRate)}</td>
                  <td className="p-4 text-right text-gray-500 font-medium tabular-nums">{formatCurrency(emp.avgOrderValue)}</td>
                  <td className="p-4 text-right text-gray-500 font-medium tabular-nums">{formatCurrency(emp.costPerOrder)}</td>
                  <td className="p-4 text-right text-gray-500 font-medium tabular-nums">{formatCurrency(emp.costPerLead)}</td>
                  <td className="p-4 text-right text-gray-500 font-medium tabular-nums">{formatCurrency(emp.costPerMessage)}</td>
                </motion.tr>
              );
            })}
          </tbody>
          <tfoot className="bg-emerald-500/10 backdrop-blur-xl">
            <tr className="font-black text-white border-t-2 border-emerald-500/30">
              <td className="p-5 text-right uppercase tracking-[0.2em] text-[10px] sticky left-0 z-10 bg-[#0a192f] border-r border-white/5">Portfolio Totals</td>
              <td className="p-5 text-right text-emerald-400 bg-emerald-500/10 tabular-nums text-base">{formatCurrency(totals.revenue)}</td>
              <td className="p-5 text-right text-red-400 bg-red-500/5 tabular-nums">{formatCurrency(totals.cost)}</td>
              <td className="p-5 text-right tabular-nums">{totals.orders.toLocaleString()}</td>
              <td className="p-5 text-right text-gray-300 tabular-nums">{totals.leads.toLocaleString()}</td>
              <td className="p-5 text-right text-gray-300 border-r border-white/5 tabular-nums">{totals.messages.toLocaleString()}</td>
              <td className="p-5 text-right text-yellow-500 bg-yellow-400/10 border-b-2 border-yellow-500/50 tabular-nums">{formatPercent(totals.adCostPercent)}</td>
              <td className="p-5 text-right text-orange-500 bg-orange-400/10 border-b-2 border-orange-500/50 tabular-nums">{formatPercent(totals.closingRate)}</td>
              <td className="p-5 text-right text-emerald-500 bg-emerald-400/10 border-b-2 border-emerald-500/50 border-r border-white/5 tabular-nums">{formatPercent(totals.contactRate)}</td>
              <td className="p-5 text-right text-gray-500 font-bold tabular-nums">{formatCurrency(totals.avgOrderValue)}</td>
              <td className="p-5 text-right text-gray-500 font-bold tabular-nums">{formatCurrency(totals.costPerOrder)}</td>
              <td className="p-5 text-right text-gray-500 font-bold tabular-nums">{formatCurrency(totals.costPerLead)}</td>
              <td className="p-5 text-right text-gray-500 font-bold tabular-nums">{formatCurrency(totals.costPerMessage)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </motion.div>
  );
};
