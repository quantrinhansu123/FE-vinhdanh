import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  X, ChevronDown, Search, MoreVertical, HelpCircle, Home, Layout,
  Users, Calendar, ChevronLeft, ChevronRight, PieChart,
  TrendingUp, MessageSquare, PlusSquare, DollarSign, CreditCard,
  MousePointer2, BarChart3, Clock, Zap
} from 'lucide-react';
import { supabase } from '../../api/supabase';

import {
  projectsMock as projects,
  dailyReportDataMock as dailyReportData,
  weeklyReportDataMock as weeklyReportData,
  monthlyReportDataMock as monthlyReportData,
  chartDataMock,
  employeeMetricsMock
} from '../../data/googleAdsMockData';
import {
  EmployeeReport
} from '../../types';

import { MiniLineChart } from '../../components/google-ads/MiniLineChart';
import { DonutChart } from '../../components/google-ads/DonutChart';
import { MetricCard } from '../../components/google-ads/MetricCard';
import { ReportTable } from '../../components/google-ads/ReportTable';
import { DashboardSummaryCard } from '../../components/google-ads/DashboardSummaryCard';
import { MetricsSummaryTable } from '../../components/google-ads/MetricsSummaryTable';
import { SoutheastAsiaMap } from '../../components/google-ads/SoutheastAsiaMap';
import { SummaryChart } from '../../components/google-ads/SummaryChart';

export type GoogleAdsPageVariant = 'modal' | 'embedded';

interface GoogleAdsPageProps {
  onClose?: () => void;
  variant?: GoogleAdsPageVariant;
  /** Khi embedded — scroll CRM (mặc định crm-dash-google-ads) */
  embeddedRootId?: string;
  children?: React.ReactNode;
}

const REPORT_TABLE = import.meta.env.VITE_SUPABASE_REPORTS_TABLE?.trim() || 'detail_reports';

export function GoogleAdsPage({
  onClose,
  variant = 'modal',
  embeddedRootId = 'crm-dash-google-ads',
  children,
}: GoogleAdsPageProps) {
  const embedded = variant === 'embedded';
  const [activeTab, setActiveTab] = useState<'main-overview' | 'overview' | 'map' | 'employee-report' | 'marketing'>('main-overview');
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [activeReportTab, setActiveReportTab] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [reports, setReports] = useState<any[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);

  useEffect(() => {
    if (activeTab === 'employee-report' || activeTab === 'overview') {
      fetchReports();
    }
  }, [activeTab]);

  const fetchReports = async () => {
    setIsLoadingReports(true);
    try {
      const { data, error } = await supabase
        .from(REPORT_TABLE)
        .select('*')
        .order('report_date', { ascending: false });

      if (error) {
        console.error('Error fetching reports:', error);
      } else {
        setReports(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoadingReports(false);
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

    grouped.forEach((emp) => {
      emp.unclosedData = emp.totalData - emp.closedData;
      emp.adsPerClosed = emp.closedData > 0 ? emp.adsCost / emp.closedData : 0;
      emp.adsPerRevenue = emp.totalRevenue > 0 ? (emp.adsCost / emp.totalRevenue) * 100 : 0;
    });

    return Array.from(grouped.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [reports]);

  const formatCurrency = (value: number) => value.toLocaleString('vi-VN');

  // Daily report totals
  const dailyReportTotals = useMemo(() => dailyReportData.reduce((acc, day) => ({
    marketingExpenses: acc.marketingExpenses + day.marketingExpenses,
    impression: acc.impression + day.impression,
    cpm: acc.cpm + day.cpm,
    comments: acc.comments + day.comments,
    commentsPerImp: acc.commentsPerImp + day.commentsPerImp,
    costPerComment: acc.costPerComment + day.costPerComment,
    newMessages: acc.newMessages + day.newMessages,
    newMessagesPerImp: acc.newMessagesPerImp + day.newMessagesPerImp,
    costPerNewMessage: acc.costPerNewMessage + day.costPerNewMessage,
    sales: acc.sales + day.sales,
    salesPerImp: acc.salesPerImp + day.salesPerImp,
    costPerSale: acc.costPerSale + day.costPerSale,
  }), {
    marketingExpenses: 0, impression: 0, cpm: 0, comments: 0, commentsPerImp: 0,
    costPerComment: 0, newMessages: 0, newMessagesPerImp: 0, costPerNewMessage: 0,
    sales: 0, salesPerImp: 0, costPerSale: 0,
  }), []);

  const avgCpm = dailyReportTotals.impression > 0 ? (dailyReportTotals.marketingExpenses / dailyReportTotals.impression) * 1000 : 0;
  const avgCommentsPerImp = dailyReportTotals.impression > 0 ? (dailyReportTotals.comments / dailyReportTotals.impression) * 100 : 0;
  const avgCostPerComment = dailyReportTotals.comments > 0 ? dailyReportTotals.marketingExpenses / dailyReportTotals.comments : 0;
  const avgNewMessagesPerImp = dailyReportTotals.impression > 0 ? (dailyReportTotals.newMessages / dailyReportTotals.impression) * 100 : 0;
  const avgCostPerNewMessage = dailyReportTotals.newMessages > 0 ? dailyReportTotals.marketingExpenses / dailyReportTotals.newMessages : 0;
  const avgSalesPerImp = dailyReportTotals.impression > 0 ? (dailyReportTotals.sales / dailyReportTotals.impression) * 100 : 0;
  const avgCostPerSale = dailyReportTotals.sales > 0 ? dailyReportTotals.marketingExpenses / dailyReportTotals.sales : 0;

  // Weekly report totals
  const weeklyReportTotals = useMemo(() => weeklyReportData.reduce((acc, week) => ({
    me: acc.me + week.me,
    impression: acc.impression + week.impression,
    cpm: acc.cpm + week.cpm,
    comments: acc.comments + week.comments,
    commentsPerImp: acc.commentsPerImp + week.commentsPerImp,
    costPerComment: acc.costPerComment + week.costPerComment,
    newMessages: acc.newMessages + week.newMessages,
    newMessagesPerImp: acc.newMessagesPerImp + week.newMessagesPerImp,
    costPerNewMessage: acc.costPerNewMessage + week.costPerNewMessage,
    sales: acc.sales + week.sales,
    salesPerImp: acc.salesPerImp + week.salesPerImp,
    costPerSale: acc.costPerSale + week.costPerSale,
  }), {
    me: 0, impression: 0, cpm: 0, comments: 0, commentsPerImp: 0,
    costPerComment: 0, newMessages: 0, newMessagesPerImp: 0, costPerNewMessage: 0,
    sales: 0, salesPerImp: 0, costPerSale: 0,
  }), []);

  const weeklyAvgCpm = weeklyReportTotals.impression > 0 ? (weeklyReportTotals.me / weeklyReportTotals.impression) * 1000 : 0;
  const weeklyAvgCommentsPerImp = weeklyReportTotals.impression > 0 ? (weeklyReportTotals.comments / weeklyReportTotals.impression) * 100 : 0;
  const weeklyAvgCostPerComment = weeklyReportTotals.comments > 0 ? weeklyReportTotals.me / weeklyReportTotals.comments : 0;
  const weeklyAvgNewMessagesPerImp = weeklyReportTotals.impression > 0 ? (weeklyReportTotals.newMessages / weeklyReportTotals.impression) * 100 : 0;
  const weeklyAvgCostPerNewMessage = weeklyReportTotals.newMessages > 0 ? weeklyReportTotals.me / weeklyReportTotals.newMessages : 0;
  const weeklyAvgSalesPerImp = weeklyReportTotals.impression > 0 ? (weeklyReportTotals.sales / weeklyReportTotals.impression) * 100 : 0;
  const weeklyAvgCostPerSale = weeklyReportTotals.sales > 0 ? weeklyReportTotals.me / weeklyReportTotals.sales : 0;

  // Monthly report totals
  const monthlyReportTotals = useMemo(() => monthlyReportData.reduce((acc, month) => ({
    me: acc.me + month.me,
    impression: acc.impression + month.impression,
    cpm: acc.cpm + month.cpm,
    comments: acc.comments + month.comments,
    commentsPerImp: acc.commentsPerImp + month.commentsPerImp,
    costPerComment: acc.costPerComment + month.costPerComment,
    newMessages: acc.newMessages + month.newMessages,
    newMessagesPerImp: acc.newMessagesPerImp + month.newMessagesPerImp,
    costPerNewMessage: acc.costPerNewMessage + month.costPerNewMessage,
    sales: acc.sales + month.sales,
    salesPerImp: acc.salesPerImp + month.salesPerImp,
    costPerSale: acc.costPerSale + month.costPerSale,
  }), {
    me: 0, impression: 0, cpm: 0, comments: 0, commentsPerImp: 0,
    costPerComment: 0, newMessages: 0, newMessagesPerImp: 0, costPerNewMessage: 0,
    sales: 0, salesPerImp: 0, costPerSale: 0,
  }), []);

  const monthlyAvgCpm = monthlyReportTotals.impression > 0 ? (monthlyReportTotals.me / monthlyReportTotals.impression) * 1000 : 0;
  const monthlyAvgCommentsPerImp = monthlyReportTotals.impression > 0 ? (monthlyReportTotals.comments / monthlyReportTotals.impression) * 100 : 0;
  const monthlyAvgCostPerComment = monthlyReportTotals.comments > 0 ? monthlyReportTotals.me / monthlyReportTotals.comments : 0;
  const monthlyAvgNewMessagesPerImp = monthlyReportTotals.impression > 0 ? (monthlyReportTotals.newMessages / monthlyReportTotals.impression) * 100 : 0;
  const monthlyAvgCostPerNewMessage = monthlyReportTotals.newMessages > 0 ? monthlyReportTotals.me / monthlyReportTotals.newMessages : 0;
  const monthlyAvgSalesPerImp = monthlyReportTotals.impression > 0 ? (monthlyReportTotals.sales / monthlyReportTotals.impression) * 100 : 0;
  const monthlyAvgCostPerSale = monthlyReportTotals.sales > 0 ? monthlyReportTotals.me / monthlyReportTotals.sales : 0;

  const {
    impressions: impressionsData,
    clicks: clicksData,
    conversions: conversionsData,
    dates: chartDates
  } = chartDataMock;

  const employeeReportTotals = useMemo(() => {
    const base = employeeMetricsMock.reduce((acc, emp) => ({
      revenue: acc.revenue + emp.revenue,
      cost: acc.cost + emp.cost,
      orders: acc.orders + emp.orders,
      leads: acc.leads + emp.leads,
      messages: acc.messages + emp.messages,
    }), { revenue: 0, cost: 0, orders: 0, leads: 0, messages: 0 });

    return {
      ...base,
      adCostPercent: base.revenue > 0 ? (base.cost / base.revenue) * 100 : 0,
      closingRate: base.messages > 0 ? (base.orders / base.messages) * 100 : 0,
      contactRate: base.messages > 0 ? (base.leads / base.messages) * 100 : 0,
      avgOrderValue: base.orders > 0 ? base.revenue / base.orders : 0,
      costPerOrder: base.orders > 0 ? base.cost / base.orders : 0,
      costPerLead: base.leads > 0 ? base.cost / base.leads : 0,
      costPerMessage: base.messages > 0 ? base.cost / base.messages : 0,
    };
  }, []);

  const shell = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={embedded ? 'relative w-full flex flex-col text-gray-200 font-sans' : 'fixed inset-0 z-[130] bg-ads-navy text-gray-200 font-sans flex flex-col'}
    >
      {!embedded && (
        <header className="h-16 bg-white flex items-center justify-between px-6 border-b border-gray-200 sticky top-0 z-50">
          <div className="flex items-center space-x-4">
            <span className="text-gray-600 font-medium text-lg">Chỉ số MKT | VPFLY</span>
            <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm flex items-center space-x-1 font-bold">
              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
              <span>Phiên bản đã xuất bản</span>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center space-x-6">
            <button className="text-gray-500 hover:text-gray-700"><MoreVertical className="w-6 h-6" /></button>
            <button className="text-gray-500 hover:text-gray-700"><HelpCircle className="w-6 h-6" /></button>
            <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-300">
              <img alt="Profile" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/..." />
            </div>
          </div>
        </header>
      )}

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className={`${embedded ? 'p-0' : 'bg-ads-sidebar p-4'}`}>
            <div className="flex items-center mb-6">
              <div className="flex items-center bg-ads-navy/30 p-1.5 rounded-xl border border-emerald-900/30">
                <button onClick={() => setActiveTab('main-overview')} className={`flex items-center space-x-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'main-overview' ? 'bg-ads-active text-white' : 'text-gray-400 hover:text-white'}`}>
                  <Home className="w-5 h-5" /><span>Overview</span>
                </button>
                <button onClick={() => setActiveTab('overview')} className={`flex items-center space-x-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${['overview', 'map'].includes(activeTab) ? 'bg-ads-active text-white' : 'text-gray-400 hover:text-white'}`}>
                  <Layout className="w-5 h-5" /><span>Campaigns</span>
                </button>
                <button onClick={() => setActiveTab('marketing')} className={`flex items-center space-x-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'marketing' ? 'bg-ads-active text-white' : 'text-gray-400 hover:text-white'}`}>
                  <PieChart className="w-5 h-5" /><span>Marketing</span>
                </button>
                <button onClick={() => setActiveTab('employee-report')} className={`flex items-center space-x-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'employee-report' ? 'bg-ads-active text-white' : 'text-gray-400 hover:text-white'}`}>
                  <Users className="w-5 h-5" /><span>Ads Details</span>
                </button>
              </div>
            </div>
          </div>

          <div className={`${embedded ? 'p-0' : 'p-4 bg-ads-navy'} flex-1 overflow-y-auto custom-scrollbar`}>
            {activeTab === 'main-overview' ? (
              <div className="space-y-0">{children}</div>
            ) : activeTab === 'overview' ? (
              <div className="flex flex-col gap-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                  <MetricCard title={projects[0].name} status={{ value: "-18.9%", isPositive: false }} mainMetric={{ label: "Impressions", value: "127,8 N" }} borderColor="border-emerald-600" secondaryMetrics={[{ label: "Search Impr. share", value: "28%", percentage: 40.4, color: "bg-red-500", align: "left" }, { label: "Search Exact match IS", value: "44%", percentage: 73.0, color: "bg-emerald-500", align: "right" }]}>
                    <MiniLineChart data={impressionsData} dates={chartDates} color="#22c55e" gradientId="imprGrad" label="Impressions" />
                    <DonutChart percentage={65} label="Share" />
                  </MetricCard>
                  <MetricCard title={projects[1].name} status={{ value: "-4.9%", isPositive: false }} mainMetric={{ label: "Clicks", value: "4,7 N" }} borderColor="border-lime-500" secondaryMetrics={[{ label: "CTR", value: "3,64%", percentage: 72.8, color: "bg-emerald-500", align: "left" }, { label: "Avg. CPC", value: "3.591 ₫", percentage: 35.9, color: "bg-emerald-500", align: "right" }]}>
                    <MiniLineChart data={clicksData} dates={chartDates} color="#34d399" gradientId="clicksGrad" label="Clicks" />
                    <DonutChart percentage={72} label="Share" color="#34d399" />
                  </MetricCard>
                  <MetricCard
                    title={projects[2].name}
                    status={{ value: "-3.4%", isPositive: false }}
                    mainMetric={{ label: "Conversions", value: "261" }}
                    borderColor="border-emerald-500"
                    secondaryMetrics={[
                      { label: "Conv. rate", value: "5,60%", percentage: 186.7, color: "bg-emerald-500", align: "left" },
                      { label: "Cost / conv.", value: "64.094 ₫", percentage: 128.2, color: "bg-emerald-500", align: "right" }
                    ]}
                  >
                    <MiniLineChart
                      data={conversionsData}
                      dates={chartDates}
                      color="#f97316"
                      gradientId="convGrad"
                      label="Conversions"
                    />
                    <DonutChart
                      percentage={56}
                      label="Share"
                      color="#f97316"
                    />
                  </MetricCard>
                </div>

                <div className="flex flex-col gap-6">
                  <div className="flex gap-2 p-1 bg-ads-navy/30 w-fit rounded-xl border border-emerald-900/10">
                    {['daily', 'weekly', 'monthly'].map(t => (
                      <button key={t} onClick={() => setActiveReportTab(t as any)} className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeReportTab === t ? 'bg-ads-active text-white' : 'text-gray-400 hover:text-white'}`}>
                        {t.charAt(0).toUpperCase() + t.slice(1)} Report
                      </button>
                    ))}
                  </div>

                  {activeReportTab === 'daily' && (
                    <ReportTable title="Daily Report" data={dailyReportData} totals={dailyReportTotals} formatCurrency={formatCurrency} type="daily"
                      avgCpm={avgCpm} avgCommentsPerImp={avgCommentsPerImp} avgCostPerComment={avgCostPerComment}
                      avgNewMessagesPerImp={avgNewMessagesPerImp} avgCostPerNewMessage={avgCostPerNewMessage}
                      avgSalesPerImp={avgSalesPerImp} avgCostPerSale={avgCostPerSale} />
                  )}
                  {activeReportTab === 'weekly' && (
                    <ReportTable title="Weekly Report" data={weeklyReportData} totals={weeklyReportTotals} formatCurrency={formatCurrency} type="weekly"
                      avgCpm={weeklyAvgCpm} avgCommentsPerImp={weeklyAvgCommentsPerImp} avgCostPerComment={weeklyAvgCostPerComment}
                      avgNewMessagesPerImp={weeklyAvgNewMessagesPerImp} avgCostPerNewMessage={weeklyAvgCostPerNewMessage}
                      avgSalesPerImp={weeklyAvgSalesPerImp} avgCostPerSale={weeklyAvgCostPerSale} />
                  )}
                  {activeReportTab === 'monthly' && (
                    <ReportTable title="Monthly Report" data={monthlyReportData} totals={monthlyReportTotals} formatCurrency={formatCurrency} type="monthly"
                      avgCpm={monthlyAvgCpm} avgCommentsPerImp={monthlyAvgCommentsPerImp} avgCostPerComment={monthlyAvgCostPerComment}
                      avgNewMessagesPerImp={monthlyAvgNewMessagesPerImp} avgCostPerNewMessage={monthlyAvgCostPerNewMessage}
                      avgSalesPerImp={monthlyAvgSalesPerImp} avgCostPerSale={monthlyAvgCostPerSale} />
                  )}
                </div>
              </div>
            ) : activeTab === 'marketing' ? (
              <div className="flex flex-col gap-6 max-w-[1600px] mx-auto w-full">
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">Marketing Dashboard</h2>
                    <p className="text-gray-400 mt-1">Real-time advertising performance and insights</p>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="text-[12px] text-gray-400 font-medium px-3 py-1 bg-white/5 rounded-full border border-white/10 flex items-center gap-2">
                      <Calendar className="w-3 h-3" />
                      Lọc ngày: 08-01 - 31-01
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <DashboardSummaryCard
                    title="Marketing Expenses"
                    icon={DollarSign}
                    metrics={[
                      { label: "Expenses:", value: "1.529.174.674", isBold: true },
                      { label: "Impression:", value: "8.659.563" },
                      { label: "CPM:", value: "176.588", color: "text-emerald-500" }
                    ]}
                  />
                  <DashboardSummaryCard
                    title="Comments Report"
                    icon={MessageSquare}
                    iconColor="text-blue-500"
                    metrics={[
                      { label: "Total comments:", value: "4.434", isBold: true },
                      { label: "Rate:", value: "0,05%", color: "text-emerald-500" },
                      { label: "Cost per:", value: "344.875" }
                    ]}
                  />
                  <DashboardSummaryCard
                    title="New Messages Report"
                    icon={PlusSquare}
                    iconColor="text-purple-500"
                    metrics={[
                      { label: "New Messages:", value: "9.311", isBold: true },
                      { label: "Rate:", value: "0,11%", color: "text-emerald-500" },
                      { label: "Cost per:", value: "164.233" }
                    ]}
                  />
                  <DashboardSummaryCard
                    title="Sales Report"
                    icon={TrendingUp}
                    iconColor="text-orange-500"
                    metrics={[
                      { label: "Total sales:", value: "607", isBold: true },
                      { label: "Rate:", value: "0,01%", color: "text-emerald-500" },
                      { label: "Cost per:", value: "2.519.233" }
                    ]}
                  />
                  <DashboardSummaryCard
                    title="Accounts Info"
                    icon={CreditCard}
                    iconColor="text-cyan-500"
                    metrics={[
                      { label: "NHATMINH:", value: "783.137.061", isBold: true },
                      { label: "PHA 14:", value: "386.488.835" },
                      { label: "PHA 33:", value: "192.837.730" }
                    ]}
                  />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-4">
                  <div className="xl:col-span-2">
                    <SummaryChart
                      title="TƯƠNG QUAN CHI TIÊU & HIỂN THỊ HÀNG NGÀY"
                      type="bar-line"
                      xLabels={["08", "09", "10", "11"]}
                      barData={[50, 85, 50, 30]}
                      lineData={[60, 75, 75, 50]}
                      color="#f97316"
                      secondaryColor="#22c55e"
                      yLeftLabels={["600 M", "300 M", "0"]}
                      yRightLabels={["3 M", "1.5 M", "0"]}
                    />
                  </div>

                  <div className="bg-ads-card/30 backdrop-blur-sm rounded-xl border border-emerald-900/10 p-6 flex flex-col items-center">
                    <div className="flex items-center gap-2 mb-8 self-start w-full">
                      <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                        <PieChart size={16} />
                      </div>
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">CHI TIÊU THEO TÀI KHOẢN</span>
                    </div>
                    <DonutChart
                      label="NhatMinh"
                      width={280}
                      height={260}
                      percentage={51.2}
                      percentageFontSize={14}
                      labelFontSize={8}
                      segments={[
                        { percentage: 51.2, color: '#10b981' },
                        { percentage: 25.3, color: '#f97316' },
                        { percentage: 12.6, color: '#22c55e' },
                        { percentage: 10.9, color: '#0ea5e9' }
                      ]}
                    />
                  </div>

                  <SummaryChart
                    title="NHẮN TIN & BÌNH LUẬN THEO NGÀY"
                    type="bar-line"
                    color="#f97316"
                    secondaryColor="#22c55e"
                    line2Color="#eab308"
                    yLeftLabels={["4K", "2K", "0"]}
                    yRightLabels={["3 M", "1.5 M", "0"]}
                    barData={[40, 45, 35, 40]}
                    lineData={[75, 75, 75, 50]}
                    line2Data={[10, 10, 75, 60]}
                  />

                  <SummaryChart
                    title="HIỂN THỊ & BÁN HÀNG THEO GIỜ"
                    type="bar-line"
                    color="#f97316"
                    secondaryColor="#22c55e"
                    yLeftLabels={["10M", "5M", "0"]}
                    yRightLabels={["600", "300", "0"]}
                    xLabels={["08:00", "12:00", "17:00", "21:00", "23:30"]}
                    barData={[2.5, 90, 97.5, 100, 100]}
                    lineData={[2.5, 2.5, 2.5, 85, 100]}
                  />

                  <SummaryChart
                    title="BÁN HÀNG & HIỂN THỊ THEO NGÀY"
                    type="bar-line"
                    yLeftLabels={["300", "150", "0"]}
                    yRightLabels={["3 M", "1.5 M", "0"]}
                  />
                </div>
              </div>
            ) : activeTab === 'map' ? (
              <div className="w-full h-full min-h-[600px] bg-ads-card rounded-xl p-6">
                <SoutheastAsiaMap selectedCountry={selectedCountry} onCountrySelect={setSelectedCountry} />
              </div>
            ) : (
              <MetricsSummaryTable data={employeeMetricsMock} totals={employeeReportTotals} formatCurrency={formatCurrency} />
            )}
          </div>
        </main>
      </div>

      {!embedded && onClose && (
        <button onClick={onClose} className="fixed top-4 right-4 z-[140] p-2 bg-black/60 text-white rounded-full">
          <X size={20} />
        </button>
      )}
    </motion.div>
  );

  return embedded ? <div id={embeddedRootId} className="w-full mb-8">{shell}</div> : shell;
}
