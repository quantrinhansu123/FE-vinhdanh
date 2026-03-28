import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { X, ChevronDown, HelpCircle, TrendingUp, DollarSign, ShoppingCart, UserCheck, MessageSquare, AlertTriangle } from 'lucide-react';
import { supabase } from '../../api/supabase';
import { MIcon } from '../../components/common/MIcon';
import { formatVnd, formatCompactM } from '../../utils/dashboardAdminUtils';

const ADS_ALERT_THRESHOLD = 40;

export type MarketingGeneralPageVariant = 'modal' | 'embedded';

interface MarketingGeneralPageProps {
  onClose?: () => void;
  variant?: MarketingGeneralPageVariant;
}

interface EmployeeReport {
  name: string;
  email: string;
  team: string;
  totalRevenue: number;
  totalData: number;
  closedData: number;
  unclosedData: number;
  adsCost: number;
  adsPerClosed: number;
  adsPerRevenue: number;
}

const REPORT_TABLE = import.meta.env.VITE_SUPABASE_REPORTS_TABLE?.trim() || 'detail_reports';

export function MarketingGeneralPage({ onClose, variant = 'modal' }: MarketingGeneralPageProps) {
  const embedded = variant === 'embedded';

  const [reports, setReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchReports();
  }, [dateRange]);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from(REPORT_TABLE)
        .select('*')
        .gte('report_date', dateRange.start)
        .lte('report_date', dateRange.end)
        .order('report_date', { ascending: false });

      if (error) {
        console.error('Error fetching reports:', error);
      } else {
        setReports(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate aggregated data by employee
  const employeeReports = useMemo(() => {
    const grouped = new Map<string, EmployeeReport>();

    reports.forEach((report) => {
      const key = report.email || report.name;
      if (!grouped.has(key)) {
        grouped.set(key, {
          name: report.name || '',
          email: report.email || '',
          team: report.team || '',
          totalRevenue: 0,
          totalData: 0,
          closedData: 0,
          unclosedData: 0,
          adsCost: 0,
          adsPerClosed: 0,
          adsPerRevenue: 0
        });
      }

      const emp = grouped.get(key)!;
      emp.totalRevenue += Number(report.revenue) || 0;
      emp.totalData += Number(report.mess_comment_count) || 0;
      emp.closedData += Number(report.order_count) || 0;
      emp.adsCost += Number(report.ad_cost) || 0;
    });

    // Calculate ratios
    grouped.forEach((emp) => {
      emp.unclosedData = emp.totalData - emp.closedData;
      emp.adsPerClosed = emp.closedData > 0 ? emp.adsCost / emp.closedData : 0;
      emp.adsPerRevenue = emp.totalRevenue > 0 ? (emp.adsCost / emp.totalRevenue) * 100 : 0;
    });

    return Array.from(grouped.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [reports]);

  // Calculate summary metrics
  const summaryMetrics = useMemo(() => {
    const totalRevenue = employeeReports.reduce((sum, emp) => sum + emp.totalRevenue, 0);
    const totalCost = employeeReports.reduce((sum, emp) => sum + emp.adsCost, 0);
    const totalOrders = employeeReports.reduce((sum, emp) => sum + emp.closedData, 0);
    const totalData = employeeReports.reduce((sum, emp) => sum + emp.totalData, 0);
    const totalMess = reports.reduce((sum, r) => sum + (Number(r.mess_comment_count) || 0), 0);

    const adsPercentage = totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0;
    const conversionRate = totalData > 0 ? (totalOrders / totalData) * 100 : 0;
    const leadRequestRate = totalMess > 0 ? (totalData / totalMess) * 100 : 0;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const orderPrice = totalOrders > 0 ? totalCost / totalOrders : 0;
    const leadPrice = totalData > 0 ? totalCost / totalData : 0;
    const messPrice = totalMess > 0 ? totalCost / totalMess : 0;

    return {
      totalRevenue, totalCost, totalOrders, totalData, totalMess,
      adsPercentage, conversionRate, leadRequestRate,
      avgOrderValue, orderPrice, leadPrice, messPrice
    };
  }, [employeeReports, reports]);

  const highAdsEmployees = employeeReports.filter(
    (emp) => emp.totalRevenue > 0 && (emp.adsCost / emp.totalRevenue) * 100 > ADS_ALERT_THRESHOLD
  );

  const formatPercentage = (value: number) => {
    return value.toFixed(1).replace('.', ',') + '%';
  };

  const SummaryCard = ({ title, value, subValue, icon, color = 'primary' }: { title: string, value: string, subValue?: string, icon: string, color?: string }) => (
    <div className={`crm-glass-card p-6 rounded-2xl border border-transparent hover:border-crm-${color}/40 transition-all group relative overflow-hidden`}>
      <div className={`absolute top-0 right-0 w-24 h-24 bg-crm-${color}/5 blur-[40px] rounded-full -mr-10 -mt-10 pointer-events-none`} />
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-extrabold text-crm-on-surface-variant tracking-[0.15em] uppercase whitespace-nowrap">{title}</span>
        <MIcon name={icon} className={`text-crm-${color} group-hover:scale-110 transition-transform`} />
      </div>
      <h2 className={`text-2xl font-extrabold text-crm-on-surface tracking-tighter ${color === 'primary' ? 'crm-glow-primary' : ''}`}>
        {value}
      </h2>
      {subValue && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border border-crm-${color}/20 bg-crm-${color}/10 text-crm-${color}`}>
            {subValue}
          </span>
        </div>
      )}
    </div>
  );

  const formatVndValue = (val: number) => formatVnd(val);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className={`crm-admin-theme flex flex-col font-crm text-crm-on-surface antialiased ${
        embedded ? 'w-full relative' : 'fixed inset-0 z-[130] bg-crm-surface'
      }`}
    >
      {(() => {
        const InnerWrapper = embedded ? 'div' : 'main';
        const wrapperClasses = embedded 
          ? "space-y-8" 
          : "flex-1 overflow-y-auto pt-8 pb-16 px-6 lg:px-10 relative space-y-8 custom-scrollbar";
        
        return (
          <InnerWrapper className={wrapperClasses}>
            {/* Top Filter & Summary Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-1">
                <h1 className="text-2xl font-extrabold tracking-tight text-crm-on-surface">Báo cáo Tổng hợp Marketing</h1>
                <p className="text-crm-on-surface-variant text-sm font-medium">Theo dõi hiệu quả chạy ads và hiệu suất chuyển đổi data</p>
              </div>

              <div className="crm-glass-card p-3 rounded-xl flex items-center gap-4 crm-date-picker-icon">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-crm-on-surface-variant tracking-wider ml-3 mb-1">Từ ngày</span>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                    className="bg-crm-surface-accent/50 border border-crm-outline/30 rounded-lg px-3 py-1.5 text-xs text-crm-on-surface focus:outline-none focus:border-crm-primary/50 transition-colors"
                  />
                </div>
                <div className="w-px h-8 bg-crm-outline/30 self-end mb-2" />
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-crm-on-surface-variant tracking-wider ml-3 mb-1">Đến ngày</span>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                    className="bg-crm-surface-accent/50 border border-crm-outline/30 rounded-lg px-3 py-1.5 text-xs text-crm-on-surface focus:outline-none focus:border-crm-primary/50 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              <SummaryCard title="Doanh số tổng" value={formatCompactM(summaryMetrics.totalRevenue)} icon="account_balance" color="primary" />
              <SummaryCard title="Chi phí Ads" value={formatCompactM(summaryMetrics.totalCost)} icon="payments" color="secondary" />
              <SummaryCard title="Tỷ lệ Ads" value={formatPercentage(summaryMetrics.adsPercentage)} subValue={summaryMetrics.totalRevenue > 0 ? "Ổn định" : "N/A"} icon="warning" color={summaryMetrics.adsPercentage > ADS_ALERT_THRESHOLD ? "error" : "success"} />
              <SummaryCard title="Tổng Đơn" value={summaryMetrics.totalOrders.toString()} icon="shopping_cart" color="accent-warm" />
              <SummaryCard title="Tổng Số (Data)" value={summaryMetrics.totalData.toString()} icon="database" color="primary" />
              <SummaryCard title="Tỷ lệ Chốt" value={formatPercentage(summaryMetrics.conversionRate)} icon="handshake" color="success" />
            </div>

            {/* Secondary Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
               <div className="crm-glass-card p-3 rounded-xl border-l-2 border-l-crm-primary-variant flex flex-col justify-center">
                  <span className="text-[9px] uppercase font-bold text-crm-on-surface-variant mb-1">TB Đơn</span>
                  <span className="text-sm font-extrabold">{formatCompactM(summaryMetrics.avgOrderValue)}</span>
               </div>
               <div className="crm-glass-card p-3 rounded-xl border-l-2 border-l-crm-secondary flex flex-col justify-center">
                  <span className="text-[9px] uppercase font-bold text-crm-on-surface-variant mb-1">Giá / Đơn</span>
                  <span className="text-sm font-extrabold">{formatCompactM(summaryMetrics.orderPrice)}</span>
               </div>
               <div className="crm-glass-card p-3 rounded-xl border-l-2 border-l-crm-success flex flex-col justify-center">
                  <span className="text-[9px] uppercase font-bold text-crm-on-surface-variant mb-1">Giá / Số</span>
                  <span className="text-sm font-extrabold">{formatCompactM(summaryMetrics.leadPrice)}</span>
               </div>
               <div className="crm-glass-card p-3 rounded-xl border-l-2 border-l-crm-accent-warm flex flex-col justify-center">
                  <span className="text-[9px] uppercase font-bold text-crm-on-surface-variant mb-1">Tổng Mess</span>
                  <span className="text-sm font-extrabold">{summaryMetrics.totalMess}</span>
               </div>
               <div className="crm-glass-card p-3 rounded-xl border-l-2 border-l-crm-primary flex flex-col justify-center">
                  <span className="text-[9px] uppercase font-bold text-crm-on-surface-variant mb-1">Giá / Mess</span>
                  <span className="text-sm font-extrabold">{formatCompactM(summaryMetrics.messPrice)}</span>
               </div>
               <div className="crm-glass-card p-3 rounded-xl border-l-2 border-l-crm-secondary-variant flex flex-col justify-center">
                  <span className="text-[9px] uppercase font-bold text-crm-on-surface-variant mb-1">% Xin Số</span>
                  <span className="text-sm font-extrabold">{formatPercentage(summaryMetrics.leadRequestRate)}</span>
               </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              <div className="xl:col-span-2">
                <div className="crm-glass-card rounded-2xl overflow-hidden border border-crm-outline/30 shadow-2xl">
                  {/* Card Header */}
                  <div className="px-6 lg:px-8 py-5 border-b border-crm-outline/30 bg-crm-surface-accent/30 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-crm-on-surface flex items-center gap-2">
                      <MIcon name="group" className="text-crm-primary" />
                      Hiệu quả theo Nhân sự
                    </h3>
                    {highAdsEmployees.length > 0 && (
                      <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-crm-error/10 border border-crm-error/20 text-crm-error flex items-center gap-1">
                        <AlertTriangle size={12} />
                        Có {highAdsEmployees.length} nhân sự vượt ngưỡng 40%
                      </span>
                    )}
                  </div>

                  {/* Card Body */}
                  <div className="p-6 lg:p-8">
                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-crm-surface-accent/60 text-crm-on-surface-variant border-b border-crm-outline/30">
                            <th className="p-4 font-extrabold uppercase tracking-tight">Nhân sự</th>
                            <th className="p-4 font-extrabold uppercase tracking-tight text-right">Doanh số</th>
                            <th className="p-4 font-bold uppercase tracking-tight text-right hidden lg:table-cell">Tổng Data</th>
                            <th className="p-4 font-bold uppercase tracking-tight text-right hidden lg:table-cell">Chốt</th>
                            <th className="p-4 font-bold uppercase tracking-tight text-right">Ads</th>
                            <th className="p-4 font-bold uppercase tracking-tight text-right shrink-0">%/DS</th>
                            <th className="p-4 font-bold uppercase tracking-tight text-right">Ads/Chốt</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-crm-outline/10">
                          {isLoading ? (
                            <tr><td colSpan={7} className="p-12 text-center text-crm-on-surface-variant italic">Đang tải dữ liệu...</td></tr>
                          ) : employeeReports.length === 0 ? (
                            <tr><td colSpan={7} className="p-12 text-center text-crm-on-surface-variant italic">Không có dữ liệu trong khoảng này</td></tr>
                          ) : (
                            employeeReports.map((emp, idx) => {
                              const adsPercentage = emp.totalRevenue > 0 ? (emp.adsCost / emp.totalRevenue) * 100 : 0;
                              const isHighAds = adsPercentage > ADS_ALERT_THRESHOLD;
                              return (
                                <tr key={idx} className={`hover:bg-crm-primary/5 transition-colors group ${isHighAds ? 'bg-crm-error/5 hover:bg-crm-error/10' : ''}`}>
                                  <td className="p-4">
                                    <div className="flex items-center gap-3">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[10px] ${isHighAds ? 'bg-crm-error/20 text-crm-error' : 'bg-crm-primary/10 text-crm-primary'}`}>
                                        {emp.name ? emp.name.slice(0, 1).toUpperCase() : '?'}
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="font-bold text-crm-on-surface group-hover:text-crm-primary transition-colors truncate max-w-[120px]">{emp.name || emp.email}</span>
                                        <span className="text-[10px] text-crm-on-surface-variant uppercase font-medium">{emp.team || 'MKT'}</span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-4 text-right font-bold text-crm-on-surface">{formatVndValue(emp.totalRevenue)}</td>
                                  <td className="p-4 text-right hidden lg:table-cell font-medium text-crm-on-surface-variant">{emp.totalData}</td>
                                  <td className="p-4 text-right hidden lg:table-cell font-medium text-crm-on-surface-variant">{emp.closedData}</td>
                                  <td className="p-4 text-right font-bold text-crm-secondary">{formatVndValue(emp.adsCost)}</td>
                                  <td className="p-4 text-right">
                                    <span className={`font-extrabold ${isHighAds ? 'text-crm-error' : 'text-crm-success'}`}>{formatPercentage(adsPercentage)}</span>
                                  </td>
                                  <td className="p-4 text-right font-medium text-crm-on-surface-variant">{formatVndValue(emp.adsPerClosed)}</td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* Guide/SOP Section */}
              <div className="space-y-6">
                <div className="crm-glass-card rounded-2xl overflow-hidden border border-crm-outline/30 shadow-2xl h-fit">
                  <div className="px-6 lg:px-8 py-5 border-b border-crm-outline/30 bg-crm-surface-accent/30">
                    <h3 className="text-lg font-bold text-crm-on-surface flex items-center gap-2">
                      <HelpCircle className="text-crm-accent-warm" />
                      Hướng dẫn & SOP Marketing
                    </h3>
                  </div>
                  <div className="p-6 lg:p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-crm-accent-warm/5 blur-[50px] rounded-full -mr-16 -mt-16 pointer-events-none" />
                    <div className="space-y-6">
                      <div className="p-4 rounded-xl bg-crm-primary/5 border border-crm-primary/10">
                        <p className="text-[11px] text-crm-on-surface-variant leading-relaxed">
                          Dữ liệu được tổng hợp tự động từ các báo cáo chi tiết. Marketing cần nhập số liệu thủ công 2 lần/ngày để đảm bảo tính chính xác.
                        </p>
                      </div>
                      <div className="space-y-4">
                        {[
                          { id: 1, t: 'Cập nhật Số liệu', d: 'Nhập doanh số, data chốt và chi phí ads từ trình quản lý quảng cáo.' },
                          { id: 2, t: 'Khung giờ báo cáo', d: 'Báo cáo 2 lần/ngày. Số liệu lần 2 là tổng lũy kế của cả ngày.' },
                          { id: 3, t: 'Tạo hóa đơn (Bill)', d: 'Tải bill báo cáo sau khi xác nhận số liệu để gửi vào nhóm quản lý.' }
                        ].map(step => (
                          <div key={step.id} className="flex gap-4">
                            <div className="w-6 h-6 rounded-lg bg-crm-outline/40 flex items-center justify-center shrink-0 text-[10px] font-bold">{step.id}</div>
                            <div>
                              <h4 className="text-[11px] font-bold text-crm-on-surface mb-1 uppercase tracking-wider">{step.t}</h4>
                              <p className="text-[10px] text-crm-on-surface-variant">{step.d}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="pt-4 border-t border-crm-outline/20">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-[10px] font-bold text-crm-on-surface-variant uppercase tracking-widest">Tiêu chuẩn Quảng cáo</span>
                          <span className="text-[10px] font-bold text-crm-error">MAX {ADS_ALERT_THRESHOLD}%</span>
                        </div>
                        <div className="w-full bg-crm-outline/20 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${summaryMetrics.adsPercentage > ADS_ALERT_THRESHOLD ? 'bg-crm-error' : 'bg-crm-success'}`} 
                            style={{ width: `${Math.min(100, (summaryMetrics.adsPercentage / ADS_ALERT_THRESHOLD) * 100)}%` }} 
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </InnerWrapper>
        );
      })()}

      {onClose && (
        <button
          onClick={onClose}
          className="fixed top-4 right-4 z-[140] p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition-all border border-white/20 backdrop-blur-md shadow-2xl"
          title="Đóng"
        >
          <X size={20} />
        </button>
      )}
    </motion.div>
  );
}
