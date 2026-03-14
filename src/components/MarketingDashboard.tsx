import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { X, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface MarketingDashboardProps {
  onClose?: () => void;
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

export function MarketingDashboard({ onClose }: MarketingDashboardProps) {
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

    // Calculate unclosed data and ratios
    grouped.forEach((emp) => {
      emp.unclosedData = emp.totalData - emp.closedData;
      emp.adsPerClosed = emp.closedData > 0 ? emp.adsCost / emp.closedData : 0;
      emp.adsPerRevenue = emp.totalRevenue > 0 ? (emp.adsCost / emp.totalRevenue) * 100 : 0;
    });

    // Sort by revenue and ads cost (lowest first)
    return Array.from(grouped.values()).sort((a, b) => {
      if (a.totalRevenue !== b.totalRevenue) {
        return a.totalRevenue - b.totalRevenue;
      }
      return a.adsCost - b.adsCost;
    });
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
      totalRevenue,
      totalCost,
      totalOrders,
      totalData,
      totalMess,
      adsPercentage,
      conversionRate,
      leadRequestRate,
      avgOrderValue,
      orderPrice,
      leadPrice,
      messPrice
    };
  }, [employeeReports, reports]);

  // Filter employees with ads cost > 40% of revenue
  const highAdsEmployees = employeeReports.filter(
    (emp) => emp.totalRevenue > 0 && (emp.adsCost / emp.totalRevenue) * 100 > 40
  );

  const formatCurrency = (value: number) => {
    return value.toLocaleString('vi-VN');
  };

  const formatPercentage = (value: number) => {
    return value.toFixed(2).replace('.', ',') + '%';
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[130] bg-gray-50 font-sans flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl font-bold mb-4">DASHBOARD THỂ HIỆN CÁC CHỈ SỐ SAU</h1>
          <div className="grid grid-cols-7 gap-2 text-sm font-semibold">
            <div>Doanh số tổng</div>
            <div>TỔNG DATA</div>
            <div>DATA CHỐT ĐƠN</div>
            <div>DATA KHÔNG CHỐT ĐƯỢC</div>
            <div>ADS</div>
            <div>ADS / CHỐT</div>
            <div>ADS / DOANH SỐ</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-7xl mx-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Section - Instructions */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white border border-gray-300 rounded-lg p-6 shadow-sm">
                <h2 className="text-lg font-bold mb-4 text-gray-800">
                  BÁO CÁO TỔNG QUAN THEO NHÂN VIÊN (cũng theo các chỉ số trên)
                </h2>
                <p className="text-sm text-gray-700 mb-4">
                  Thứ tự nhân viên có doanh thu và chi phí ads thấp hiện lên đầu.
                </p>
                <p className="text-sm text-gray-700 mb-4">
                  <strong>Xếp hạng các nhân sự có chi phí ads cao trên 40%</strong>
                </p>
                <p className="text-sm text-gray-700 mb-4">
                  <strong>Chức năng:</strong> Tạo tài khoản cho từng marketing theo dự án chỉ định, gắn mã ID tài khoản quảng cáo của từng mkt (1 mkt có thể có 2-3 Tài khoản)
                </p>

                <div className="mt-6 border-t border-gray-300 pt-4">
                  <h3 className="font-bold text-gray-800 mb-3">Nhập báo cáo:</h3>
                  <p className="text-sm text-gray-600 mb-4 italic">
                    (Phần này marketing sẽ nhập thủ công, số liệu lấy từ trình quảng cáo và crm,)
                  </p>
                  <ul className="space-y-3 text-sm text-gray-700">
                    <li>
                      <strong>Doanh số:</strong> (Doanh số |)
                    </li>
                    <li>
                      <strong>Số lượng data</strong>
                    </li>
                    <li>
                      <strong>Data chốt</strong>
                      <span className="text-gray-500 text-xs ml-2">
                        Sau khi nhập sẽ ra được trung bình đơn, tỷ lệ chốt
                      </span>
                    </li>
                    <li>
                      <strong>Data không chốt được</strong>
                      <span className="text-gray-500 text-xs ml-2 block mt-1">
                        Lưu ý: 1 ngày mkt sẽ báo cáo 2 lần vào 2 khung giờ khác nhau. Số liệu nhập lần 2 sẽ là tổng của cả lần 1.
                      </span>
                    </li>
                    <li>
                      <strong>Chi phí ads</strong>
                      <span className="text-gray-500 text-xs ml-2 block mt-1">
                        Sau khi nhập đủ số liệu hệ thống tạo 1 bill dạng giống hóa đơn. Sau đó mkt tải về và gửi vào nhóm báo cáo. Trong bill này bao gồm tên mkt. Ngày /tháng/năm.
                      </span>
                    </li>
                    <li>
                      <strong>ADS / CHỐT</strong>
                    </li>
                    <li>
                      <strong>ADS / DOANH SỐ</strong>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Date Range Filter */}
              <div className="bg-white border border-gray-300 rounded-lg p-4 shadow-sm">
                <div className="flex gap-4 items-center">
                  <label className="text-sm font-medium text-gray-700">Từ ngày:</label>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                    className="border border-gray-300 rounded px-3 py-1 text-sm"
                  />
                  <label className="text-sm font-medium text-gray-700">Đến ngày:</label>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                    className="border border-gray-300 rounded px-3 py-1 text-sm"
                  />
                </div>
              </div>

              {/* Employee Reports Table */}
              <div className="bg-white border border-gray-300 rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-blue-600 text-white">
                      <tr>
                        <th className="p-3 text-left border-r border-blue-500">Tên</th>
                        <th className="p-3 text-right border-r border-blue-500">Doanh số tổng</th>
                        <th className="p-3 text-right border-r border-blue-500">TỔNG DATA</th>
                        <th className="p-3 text-right border-r border-blue-500">DATA CHỐT ĐƠN</th>
                        <th className="p-3 text-right border-r border-blue-500">DATA KHÔNG CHỐT</th>
                        <th className="p-3 text-right border-r border-blue-500">ADS</th>
                        <th className="p-3 text-right border-r border-blue-500">ADS / CHỐT</th>
                        <th className="p-3 text-right">ADS / DOANH SỐ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-gray-500">
                            Đang tải dữ liệu...
                          </td>
                        </tr>
                      ) : employeeReports.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-gray-500">
                            Không có dữ liệu
                          </td>
                        </tr>
                      ) : (
                        employeeReports.map((emp, idx) => {
                          const adsPercentage = emp.totalRevenue > 0 ? (emp.adsCost / emp.totalRevenue) * 100 : 0;
                          const isHighAds = adsPercentage > 40;
                          
                          return (
                            <tr
                              key={idx}
                              className={`border-b border-gray-200 hover:bg-gray-50 ${
                                isHighAds ? 'bg-red-50' : ''
                              }`}
                            >
                              <td className="p-3 border-r border-gray-200 font-medium">
                                {emp.name || emp.email}
                                {isHighAds && (
                                  <span className="ml-2 text-xs bg-red-500 text-white px-2 py-0.5 rounded">
                                    &gt;40%
                                  </span>
                                )}
                              </td>
                              <td className="p-3 border-r border-gray-200 text-right">
                                {formatCurrency(emp.totalRevenue)}
                              </td>
                              <td className="p-3 border-r border-gray-200 text-right">
                                {formatCurrency(emp.totalData)}
                              </td>
                              <td className="p-3 border-r border-gray-200 text-right">
                                {formatCurrency(emp.closedData)}
                              </td>
                              <td className="p-3 border-r border-gray-200 text-right">
                                {formatCurrency(emp.unclosedData)}
                              </td>
                              <td className="p-3 border-r border-gray-200 text-right">
                                {formatCurrency(emp.adsCost)}
                              </td>
                              <td className="p-3 border-r border-gray-200 text-right">
                                {formatCurrency(emp.adsPerClosed)}
                              </td>
                              <td className="p-3 text-right">
                                {formatPercentage(emp.adsPerRevenue)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Section - Summary Box */}
            <div className="lg:col-span-1">
              <div className="bg-white border-4 border-green-500 rounded-lg p-6 shadow-lg sticky top-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">TỔNG HỢP</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">DOANH SỐ</span>
                    <span className="text-sm font-bold text-yellow-600 bg-yellow-100 px-2 py-1 rounded">
                      {formatCurrency(summaryMetrics.totalRevenue)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">CHI PHÍ</span>
                    <span className="text-sm font-bold text-yellow-600 bg-yellow-100 px-2 py-1 rounded">
                      {formatCurrency(summaryMetrics.totalCost)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">SL ĐƠN</span>
                    <span className="text-sm font-bold text-yellow-600 bg-yellow-100 px-2 py-1 rounded">
                      {summaryMetrics.totalOrders}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">SL SỐ</span>
                    <span className="text-sm font-bold text-yellow-600 bg-yellow-100 px-2 py-1 rounded">
                      {summaryMetrics.totalData}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">SL MESS</span>
                    <span className="text-sm font-bold text-yellow-600 bg-yellow-100 px-2 py-1 rounded">
                      {summaryMetrics.totalMess}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">% ADS</span>
                    <span className="text-sm font-bold text-yellow-600 bg-yellow-100 px-2 py-1 rounded">
                      {formatPercentage(summaryMetrics.adsPercentage)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">% CHỐT</span>
                    <span className="text-sm font-bold text-yellow-600 bg-yellow-100 px-2 py-1 rounded">
                      {formatPercentage(summaryMetrics.conversionRate)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">% XIN SỐ</span>
                    <span className="text-sm font-bold text-yellow-600 bg-yellow-100 px-2 py-1 rounded">
                      {formatPercentage(summaryMetrics.leadRequestRate)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">TB ĐƠN</span>
                    <span className="text-sm font-bold text-yellow-600 bg-yellow-100 px-2 py-1 rounded">
                      {formatCurrency(summaryMetrics.avgOrderValue)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">GIÁ ĐƠN</span>
                    <span className="text-sm font-bold text-yellow-600 bg-yellow-100 px-2 py-1 rounded">
                      {formatCurrency(summaryMetrics.orderPrice)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">GIÁ SỐ</span>
                    <span className="text-sm font-bold text-yellow-600 bg-yellow-100 px-2 py-1 rounded">
                      {formatCurrency(summaryMetrics.leadPrice)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">GIÁ MESS</span>
                    <span className="text-sm font-bold text-yellow-600 bg-yellow-100 px-2 py-1 rounded">
                      {formatCurrency(summaryMetrics.messPrice)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Close Button */}
      {onClose && (
        <button
          onClick={onClose}
          className="fixed top-4 right-4 z-[140] p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition-all border border-white/20 backdrop-blur-md"
          title="Đóng"
        >
          <X size={20} />
        </button>
      )}
    </motion.div>
  );
}
