import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, X, TrendingUp } from 'lucide-react';
import { supabase } from '../../api/supabase';

interface Employee {
  id: string;
  name: string;
  team: string;
  score: number;
  avatar_url: string | null;
  email?: string;
}

interface DailyReport {
  report_date: string;
  name: string;
  email: string;
  product: string;
  market: string;
  ad_account: string;
  ad_cost: number | null;
  mess_comment_count: number | null;
  order_count: number | null;
  revenue: number | null;
  team: string;
}

const EMPLOYEES_TABLE = import.meta.env.VITE_SUPABASE_EMPLOYEES_TABLE?.trim() || 'employees';
const REPORT_TABLE = import.meta.env.VITE_SUPABASE_REPORTS_TABLE?.trim() || 'detail_reports';

export type ProgressPageVariant = 'modal' | 'embedded';

export function ProgressPage({
  onClose,
  variant = 'modal',
  embeddedRootId = 'crm-dashboard-progress',
}: {
  onClose?: () => void;
  variant?: ProgressPageVariant;
  /** `id` trên wrapper khi embedded — để scroll CRM (vd. Team → Tiến bộ) */
  embeddedRootId?: string;
}) {
  const embedded = variant === 'embedded';
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'individual' | 'comparison'>('individual');
  const [comparisonData, setComparisonData] = useState<Map<string, any[]>>(new Map());

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from(EMPLOYEES_TABLE)
      .select('*')
      .order('score', { ascending: false });

    if (error) {
      console.error('Error fetching employees:', error);
    } else {
      setEmployees(data || []);
      if (data && data.length > 0) {
        setSelectedEmployee(data[0]);
        fetchDailyReports(data[0]);
      }
    }
    setIsLoading(false);
  };

  const fetchDailyReports = async (employee: Employee) => {
    const { data, error } = await supabase
      .from(REPORT_TABLE)
      .select('*')
      .eq('email', employee.email)
      .order('report_date', { ascending: false })
      .limit(30);

    if (error) {
      console.error('Error fetching reports:', error);
    } else {
      setDailyReports(data || []);
      // Prepare chart data - group by date and sum revenue
      const grouped = new Map<string, { date: string; revenue: number; orders: number; adCost: number }>();
      (data || []).forEach((report) => {
        const key = report.report_date;
        if (!grouped.has(key)) {
          grouped.set(key, { date: key, revenue: 0, orders: 0, adCost: 0 });
        }
        const item = grouped.get(key)!;
        item.revenue += report.revenue || 0;
        item.orders += report.order_count || 0;
        item.adCost += report.ad_cost || 0;
      });
      const sorted = Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date));
      setChartData(sorted);
    }
  };

  const handleSelectEmployee = (emp: Employee) => {
    setSelectedEmployee(emp);
    fetchDailyReports(emp);
  };

  const fetchAllComparison = async () => {
    if (employees.length === 0) return;
    
    const { data, error } = await supabase
      .from(REPORT_TABLE)
      .select('*')
      .order('report_date', { ascending: true })
      .limit(1000);

    if (error) {
      console.error('Error fetching comparison data:', error);
      return;
    }

    const employeeMap = new Map<string, any[]>();
    employees.forEach((emp) => {
      const empReports = (data || []).filter((r) => r.email === emp.email);
      const grouped = new Map<string, number>();
      empReports.forEach((report) => {
        const existing = grouped.get(report.report_date) || 0;
        grouped.set(report.report_date, existing + (report.revenue || 0));
      });
      const sorted = Array.from(grouped.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, revenue]) => ({ date, revenue }));
      employeeMap.set(emp.id, sorted);
    });
    setComparisonData(employeeMap);
  };

  useEffect(() => {
    if (activeTab === 'comparison' && comparisonData.size === 0) {
      fetchAllComparison();
    }
  }, [activeTab, employees]);

  const totalRevenue = dailyReports.reduce((sum, r) => sum + (r.revenue || 0), 0);
  const totalOrders = dailyReports.reduce((sum, r) => sum + (r.order_count || 0), 0);
  const totalAdCost = dailyReports.reduce((sum, r) => sum + (r.ad_cost || 0), 0);

  const shell = (
      <motion.div
        initial={embedded ? false : { scale: 0.95, y: 12 }}
        animate={embedded ? false : { scale: 1, y: 0 }}
        className={
          embedded
            ? 'w-full crm-glass-card rounded-2xl border border-emerald-500/25 flex flex-col overflow-hidden bg-gradient-to-br from-emerald-950/35 to-crm-surface/80'
            : 'mx-auto max-w-7xl bg-gradient-to-br from-emerald-950/50 to-slate-950/50 border border-emerald-500/35 rounded-2xl flex flex-col overflow-hidden backdrop-blur-sm'
        }
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-emerald-500/30 bg-emerald-950/50 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4 gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-crm-on-surface flex items-center gap-2">
                <TrendingUp className="text-emerald-400 shrink-0" />
                Chi tiết tiến bộ nhân viên
              </h2>
              <p className="text-emerald-200/70 text-sm mt-1">Theo dõi báo cáo hàng ngày và biểu đồ tiến bộ</p>
            </div>
            {!embedded && onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg text-emerald-200/70 hover:text-white hover:bg-emerald-500/20 shrink-0"
              >
                <X size={24} />
              </button>
            ) : null}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('individual')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'individual'
                  ? 'bg-emerald-600 text-white shadow-[0_0_16px_rgba(34,197,94,0.35)]'
                  : 'bg-emerald-900/40 text-emerald-200 hover:bg-emerald-800/50 border border-emerald-500/20'
              }`}
            >
              Chi tiết cá nhân
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('comparison')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'comparison'
                  ? 'bg-emerald-600 text-white shadow-[0_0_16px_rgba(34,197,94,0.35)]'
                  : 'bg-emerald-900/40 text-emerald-200 hover:bg-emerald-800/50 border border-emerald-500/20'
              }`}
            >
              So sánh nhân viên
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="h-96 flex items-center justify-center gap-2 text-emerald-100">
            <Loader2 className="animate-spin" size={24} />
            <span>Đang tải dữ liệu...</span>
          </div>
        ) : activeTab === 'individual' ? (
          <div className="flex-1 overflow-auto">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 p-6">
              {/* Left: Employee List */}
              <div className="lg:col-span-1">
                <div className="bg-emerald-900/30 border border-emerald-500/20 rounded-xl p-4 space-y-2 max-h-96 overflow-y-auto">
                  <h3 className="text-sm font-bold text-emerald-200 uppercase mb-3">Chọn nhân viên</h3>
                  {employees.map((emp) => (
                    <button
                      key={emp.id}
                      onClick={() => handleSelectEmployee(emp)}
                      className={`w-full text-left p-3 rounded-lg transition-all flex items-center gap-3 ${
                        selectedEmployee?.id === emp.id
                          ? 'bg-emerald-500/40 border border-emerald-300 text-white'
                          : 'bg-emerald-800/20 border border-emerald-500/10 text-emerald-100 hover:bg-emerald-800/30'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-emerald-900 border border-emerald-500/30">
                        <img
                          src={emp.avatar_url || 'https://via.placeholder.com/40'}
                          alt={emp.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-xs truncate">{emp.name}</p>
                        <p className="text-xs opacity-70">{emp.team}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Right: Details */}
              <div className="lg:col-span-3 space-y-6">
                {selectedEmployee && (
                  <>
                    {/* Employee Card */}
                    <div className="bg-gradient-to-r from-emerald-600/20 to-emerald-800/20 border border-emerald-500/30 rounded-xl p-6 flex gap-4">
                      <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 border-2 border-emerald-400 shadow-lg">
                        <img
                          src={selectedEmployee.avatar_url || 'https://via.placeholder.com/100'}
                          alt={selectedEmployee.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold text-white">{selectedEmployee.name}</h3>
                        <p className="text-emerald-200 text-sm mt-1">Team: {selectedEmployee.team}</p>
                        <p className="text-emerald-100/60 text-sm mt-1">Email: {selectedEmployee.email}</p>
                        <div className="flex gap-4 mt-3">
                          <div className="bg-emerald-500/20 border border-emerald-500/40 rounded-lg px-3 py-1">
                            <p className="text-xs text-emerald-200">Doanh số</p>
                            <p className="text-lg font-bold text-emerald-100">{selectedEmployee.score.toLocaleString()}</p>
                          </div>
                          <div className="bg-emerald-500/20 border border-emerald-500/40 rounded-lg px-3 py-1">
                            <p className="text-xs text-emerald-200">Tổng báo cáo</p>
                            <p className="text-lg font-bold text-emerald-100">{dailyReports.length}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-emerald-800/40 border border-emerald-500/20 rounded-lg p-4 text-center">
                        <p className="text-emerald-200/60 text-xs uppercase">Tổng doanh số</p>
                        <p className="text-2xl font-bold text-emerald-100 mt-2">{totalRevenue.toLocaleString()}</p>
                      </div>
                      <div className="bg-emerald-800/40 border border-emerald-500/20 rounded-lg p-4 text-center">
                        <p className="text-emerald-200/60 text-xs uppercase">Tổng đơn</p>
                        <p className="text-2xl font-bold text-emerald-100 mt-2">{totalOrders.toLocaleString()}</p>
                      </div>
                      <div className="bg-emerald-800/40 border border-emerald-500/20 rounded-lg p-4 text-center">
                        <p className="text-emerald-200/60 text-xs uppercase">Chi phí QC</p>
                        <p className="text-2xl font-bold text-emerald-100 mt-2">{totalAdCost.toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Charts */}
                    {chartData.length > 0 && (
                      <div className="space-y-4">
                        {/* Revenue Chart */}
                        <div className="bg-emerald-900/20 border border-emerald-500/20 rounded-xl p-4">
                          <h4 className="text-sm font-bold text-emerald-200 mb-3">Doanh số theo ngày</h4>
                          <div className="h-64 flex items-end gap-1 px-4">
                            {chartData.map((item, idx) => {
                              const maxRevenue = Math.max(...chartData.map((d) => d.revenue));
                              const height = maxRevenue > 0 ? (item.revenue / maxRevenue) * 100 : 0;
                              return (
                                <div key={idx} className="flex-1 flex flex-col items-center group">
                                  <div
                                    className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-md hover:from-emerald-500 hover:to-emerald-300 transition-all cursor-pointer relative"
                                    style={{ height: `${height}%`, minHeight: height > 0 ? '4px' : '0' }}
                                    title={`${item.date}: ${item.revenue.toLocaleString()}`}
                                  >
                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-emerald-900/90 border border-emerald-500/50 rounded px-2 py-1 text-xs text-emerald-100 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                      {item.revenue.toLocaleString()}
                                    </div>
                                  </div>
                                  <p className="text-[10px] text-emerald-300/60 mt-1 truncate w-full text-center">
                                    {item.date.split('-').slice(1).join('/')}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Orders & Ad Cost Chart */}
                        <div className="bg-emerald-900/20 border border-emerald-500/20 rounded-xl p-4">
                          <h4 className="text-sm font-bold text-emerald-200 mb-3">Số đơn & Chi phí QC</h4>
                          <div className="h-64 relative">
                            <svg width="100%" height="100%" viewBox="0 0 600 200" preserveAspectRatio="none">
                              <defs>
                                <linearGradient id="ordersGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                  <stop offset="0%" stopColor="#34d399" stopOpacity="0.35" />
                                  <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
                                </linearGradient>
                                <linearGradient id="adCostGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                  <stop offset="0%" stopColor="#059669" stopOpacity="0.35" />
                                  <stop offset="100%" stopColor="#059669" stopOpacity="0" />
                                </linearGradient>
                              </defs>
                              {(() => {
                                const maxOrders = Math.max(...chartData.map((d) => d.orders), 1);
                                const maxAdCost = Math.max(...chartData.map((d) => d.adCost), 1);
                                const ordersPoints = chartData.map((item, idx) => ({
                                  x: (idx / (chartData.length - 1)) * 600,
                                  y: 200 - (item.orders / maxOrders) * 180,
                                }));
                                const adCostPoints = chartData.map((item, idx) => ({
                                  x: (idx / (chartData.length - 1)) * 600,
                                  y: 200 - (item.adCost / maxAdCost) * 180,
                                }));
                                const ordersPath = ordersPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
                                const adCostPath = adCostPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
                                return (
                                  <>
                                    <path d={`${ordersPath} L600,200 L0,200 Z`} fill="url(#ordersGradient)" />
                                    <path d={ordersPath} stroke="#34d399" strokeWidth="2" fill="none" />
                                    <path d={`${adCostPath} L600,200 L0,200 Z`} fill="url(#adCostGradient)" />
                                    <path d={adCostPath} stroke="#059669" strokeWidth="2" fill="none" />
                                  </>
                                );
                              })()}
                            </svg>
                            <div className="absolute bottom-2 right-2 flex gap-4 text-xs">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-0.5 bg-emerald-500"></div>
                                <span className="text-emerald-200">Số đơn</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-0.5 bg-emerald-600"></div>
                                <span className="text-emerald-200">Chi phí QC</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Reports Table */}
                    <div className="bg-emerald-900/20 border border-emerald-500/20 rounded-xl p-4 overflow-x-auto">
                      <h4 className="text-sm font-bold text-emerald-200 mb-3">Chi tiết báo cáo hàng ngày</h4>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-emerald-500/20">
                            <th className="text-left py-2 px-3 text-emerald-300">Ngày</th>
                            <th className="text-left py-2 px-3 text-emerald-300">Sản phẩm</th>
                            <th className="text-left py-2 px-3 text-emerald-300">Thị trường</th>
                            <th className="text-right py-2 px-3 text-emerald-300">AD Cost</th>
                            <th className="text-right py-2 px-3 text-emerald-300">Mess/Cmt</th>
                            <th className="text-right py-2 px-3 text-emerald-300">Đơn</th>
                            <th className="text-right py-2 px-3 text-emerald-300">Doanh số</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-emerald-500/10">
                          {dailyReports.slice(0, 20).map((report, idx) => (
                            <tr key={idx} className="hover:bg-emerald-500/10 transition-colors">
                              <td className="py-2 px-3 text-emerald-100">{report.report_date}</td>
                              <td className="py-2 px-3 text-emerald-100">{report.product || '-'}</td>
                              <td className="py-2 px-3 text-emerald-100">{report.market || '-'}</td>
                              <td className="py-2 px-3 text-right text-emerald-200">
                                {report.ad_cost ? report.ad_cost.toLocaleString() : '-'}
                              </td>
                              <td className="py-2 px-3 text-right text-emerald-200">{report.mess_comment_count || '-'}</td>
                              <td className="py-2 px-3 text-right text-emerald-200">{report.order_count || '-'}</td>
                              <td className="py-2 px-3 text-right text-emerald-100 font-semibold">
                                {report.revenue ? report.revenue.toLocaleString() : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-6">
            {/* Comparison View */}
            <div className="space-y-6">
              {/* Multi-line Chart */}
              <div className="bg-emerald-900/20 border border-emerald-500/20 rounded-xl p-6">
                <h4 className="text-lg font-bold text-emerald-200 mb-4">So sánh doanh số theo thời gian</h4>
                
                {/* Legend with Avatars */}
                <div className="flex flex-wrap gap-3 mb-4">
                  {employees.slice(0, 5).map((emp, idx) => {
                    const colors = ['#22c55e', '#16a34a', '#84cc16', '#65a30d', '#4ade80'];
                    return (
                      <div key={emp.id} className="flex items-center gap-2 bg-emerald-800/30 rounded-lg px-3 py-2">
                        <div className="w-8 h-8 rounded-full overflow-hidden border-2" style={{ borderColor: colors[idx] }}>
                          <img
                            src={emp.avatar_url || 'https://via.placeholder.com/32'}
                            alt={emp.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-emerald-100">{emp.name}</p>
                          <p className="text-[10px] text-emerald-300/60">{emp.team}</p>
                        </div>
                        <div className="w-4 h-1 rounded-full" style={{ backgroundColor: colors[idx] }}></div>
                      </div>
                    );
                  })}
                </div>

                {/* Chart */}
                <div className="h-96 relative">
                  <svg width="100%" height="100%" viewBox="0 0 800 300" preserveAspectRatio="none">
                    <defs>
                      {employees.slice(0, 5).map((emp, idx) => {
                        const colors = ['#22c55e', '#16a34a', '#84cc16', '#65a30d', '#4ade80'];
                        return (
                          <linearGradient key={emp.id} id={`grad-${idx}`} x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor={colors[idx]} stopOpacity="0.3" />
                            <stop offset="100%" stopColor={colors[idx]} stopOpacity="0" />
                          </linearGradient>
                        );
                      })}
                    </defs>
                    
                    {/* Grid lines */}
                    {[0, 1, 2, 3, 4].map((i) => (
                      <line
                        key={i}
                        x1="0"
                        y1={i * 75}
                        x2="800"
                        y2={i * 75}
                        stroke="rgba(52,211,153,0.12)"
                        strokeDasharray="3,3"
                      />
                    ))}

                    {/* Revenue lines for each employee */}
                    {employees.slice(0, 5).map((emp, idx) => {
                      const colors = ['#22c55e', '#16a34a', '#84cc16', '#65a30d', '#4ade80'];
                      const empData = comparisonData.get(emp.id) || [];
                      if (empData.length === 0) return null;

                      const maxRevenue = Math.max(
                        ...Array.from(comparisonData.values()).flatMap((data) =>
                          data.map((d) => d.revenue)
                        ),
                        1
                      );

                      const points = empData.map((item, i) => ({
                        x: (i / Math.max(empData.length - 1, 1)) * 800,
                        y: 300 - (item.revenue / maxRevenue) * 280,
                      }));

                      // Create smooth curve using cubic bezier
                      const smoothPath = points.map((p, i) => {
                        if (i === 0) return `M ${p.x},${p.y}`;
                        
                        const prev = points[i - 1];
                        const next = points[i + 1];
                        
                        // Calculate control points for smooth curve
                        const tension = 0.3;
                        const cp1x = prev.x + (p.x - prev.x) * tension;
                        const cp1y = prev.y;
                        const cp2x = p.x - (next ? (next.x - p.x) : 0) * tension;
                        const cp2y = p.y;
                        
                        return `C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p.x},${p.y}`;
                      }).join(' ');

                      const fillPath = `${smoothPath} L800,300 L0,300 Z`;

                      return (
                        <g key={emp.id}>
                          <path d={fillPath} fill={`url(#grad-${idx})`} />
                          <path d={smoothPath} stroke={colors[idx]} strokeWidth="3" fill="none" />
                          
                          {/* Avatar images on data points */}
                          {points.filter((_, pIdx) => pIdx % Math.max(1, Math.floor(points.length / 8)) === 0).map((point, pIdx) => (
                            <g key={pIdx}>
                              <foreignObject
                                x={point.x - 16}
                                y={point.y - 16}
                                width="32"
                                height="32"
                                style={{ overflow: 'visible' }}
                              >
                                <div className="w-8 h-8 rounded-full overflow-hidden border-2 shadow-lg" style={{ borderColor: colors[idx] }}>
                                  <img
                                    src={emp.avatar_url || 'https://via.placeholder.com/32'}
                                    alt={emp.name}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              </foreignObject>
                            </g>
                          ))}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {employees.slice(0, 5).map((emp) => {
                  const empData = comparisonData.get(emp.id) || [];
                  const totalRev = empData.reduce((sum, d) => sum + d.revenue, 0);
                  return (
                    <div key={emp.id} className="bg-emerald-800/30 border border-emerald-500/20 rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-emerald-400">
                          <img
                            src={emp.avatar_url || 'https://via.placeholder.com/48'}
                            alt={emp.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-emerald-100 truncate">{emp.name}</p>
                          <p className="text-xs text-emerald-300/60">{emp.team}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-emerald-200/60 uppercase">Tổng doanh số</p>
                        <p className="text-xl font-bold text-emerald-100 mt-1">{totalRev.toLocaleString()}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </motion.div>
  );

  if (embedded) {
    return (
      <div id={embeddedRootId} className="w-full mb-8">
        {shell}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-sm p-4 overflow-auto"
    >
      {shell}
    </motion.div>
  );
}
