import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { X, ChevronDown, Search, MoreVertical, HelpCircle, Home, Layout, Users, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SearchTerm {
  id: number;
  term: string;
  matchType: string;
  conversions: number;
  costPerConv: string;
  convRate: string;
  cost: string;
  clicks: number;
  avgCPC: string;
  ctr: string;
  impressions: number;
  avgCPM: string;
}

interface GoogleAdsDashboardProps {
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

interface AdsMetrics {
  team: string;
  name: string;
  email: string;
  soMess: number; // Số Mess
  cpqc: number; // CPQC (Cost Per Qualified Contact)
  soDon: number; // Số Đơn
  soDonTT: number; // Số Đơn (TT)
  dsChot: number; // DS Chốt
  dsChotTT: number; // DS Chốt (TT)
  tiLeChot: number; // Tỉ lệ chốt (%)
  tiLeChotTT: number; // Tỉ lệ chốt (TT) (%)
  giaMess: number; // Giá Mess
  cps: number; // CPS (Cost Per Sale)
  cpds: number; // %CP/DS
  giaTBDon: number; // Giá TB Đơn
}

const REPORT_TABLE = import.meta.env.VITE_SUPABASE_REPORTS_TABLE?.trim() || 'detail_reports';

export function GoogleAdsDashboard({ onClose }: GoogleAdsDashboardProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'overview' | 'map' | 'employee-report'>('overview');
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
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

  // Mock data for Ads Metrics
  const mockAdsMetrics: AdsMetrics[] = [
    {
      team: 'Team Alpha',
      name: 'Nguyen Van A',
      email: 'a.marketing@example.com',
      soMess: 1250,
      cpqc: 8500,
      soDon: 45,
      soDonTT: 42,
      dsChot: 12500000,
      dsChotTT: 11800000,
      tiLeChot: 3.6,
      tiLeChotTT: 3.36,
      giaMess: 8500,
      cps: 236111,
      cpds: 8.5,
      giaTBDon: 277778
    },
    {
      team: 'Team Beta',
      name: 'Tran Thi B',
      email: 'b.marketing@example.com',
      soMess: 980,
      cpqc: 9200,
      soDon: 38,
      soDonTT: 35,
      dsChot: 9800000,
      dsChotTT: 9200000,
      tiLeChot: 3.88,
      tiLeChotTT: 3.57,
      giaMess: 9200,
      cps: 242105,
      cpds: 9.39,
      giaTBDon: 257895
    },
    {
      team: 'Team Gamma',
      name: 'Le Van C',
      email: 'c.marketing@example.com',
      soMess: 1500,
      cpqc: 7800,
      soDon: 52,
      soDonTT: 50,
      dsChot: 15000000,
      dsChotTT: 14500000,
      tiLeChot: 3.47,
      tiLeChotTT: 3.33,
      giaMess: 7800,
      cps: 225000,
      cpds: 7.8,
      giaTBDon: 288462
    },
    {
      team: 'Team Alpha',
      name: 'Pham Thi D',
      email: 'd.marketing@example.com',
      soMess: 1100,
      cpqc: 9500,
      soDon: 40,
      soDonTT: 38,
      dsChot: 11000000,
      dsChotTT: 10500000,
      tiLeChot: 3.64,
      tiLeChotTT: 3.45,
      giaMess: 9500,
      cps: 237500,
      cpds: 8.64,
      giaTBDon: 275000
    },
    {
      team: 'Team Beta',
      name: 'Hoang Van E',
      email: 'e.marketing@example.com',
      soMess: 1350,
      cpqc: 8200,
      soDon: 48,
      soDonTT: 45,
      dsChot: 13500000,
      dsChotTT: 12800000,
      tiLeChot: 3.56,
      tiLeChotTT: 3.33,
      giaMess: 8200,
      cps: 229167,
      cpds: 8.15,
      giaTBDon: 281250
    },
    {
      team: 'Team Gamma',
      name: 'Vu Thi F',
      email: 'f.marketing@example.com',
      soMess: 1680,
      cpqc: 7200,
      soDon: 58,
      soDonTT: 55,
      dsChot: 16800000,
      dsChotTT: 16200000,
      tiLeChot: 3.45,
      tiLeChotTT: 3.27,
      giaMess: 7200,
      cps: 206897,
      cpds: 7.2,
      giaTBDon: 289655
    },
    {
      team: 'Team Alpha',
      name: 'Dao Van G',
      email: 'g.marketing@example.com',
      soMess: 1420,
      cpqc: 8800,
      soDon: 50,
      soDonTT: 47,
      dsChot: 14200000,
      dsChotTT: 13500000,
      tiLeChot: 3.52,
      tiLeChotTT: 3.31,
      giaMess: 8800,
      cps: 249600,
      cpds: 8.8,
      giaTBDon: 284000
    },
    {
      team: 'Team Beta',
      name: 'Bui Thi H',
      email: 'h.marketing@example.com',
      soMess: 1150,
      cpqc: 9100,
      soDon: 42,
      soDonTT: 40,
      dsChot: 11500000,
      dsChotTT: 11000000,
      tiLeChot: 3.65,
      tiLeChotTT: 3.48,
      giaMess: 9100,
      cps: 238095,
      cpds: 9.1,
      giaTBDon: 273810
    },
    {
      team: 'Team Gamma',
      name: 'Ngo Van I',
      email: 'i.marketing@example.com',
      soMess: 1320,
      cpqc: 8300,
      soDon: 47,
      soDonTT: 44,
      dsChot: 13200000,
      dsChotTT: 12600000,
      tiLeChot: 3.56,
      tiLeChotTT: 3.33,
      giaMess: 8300,
      cps: 231915,
      cpds: 8.3,
      giaTBDon: 280851
    },
    {
      team: 'Team Alpha',
      name: 'Ly Thi K',
      email: 'k.marketing@example.com',
      soMess: 1580,
      cpqc: 7500,
      soDon: 55,
      soDonTT: 52,
      dsChot: 15800000,
      dsChotTT: 15200000,
      tiLeChot: 3.48,
      tiLeChotTT: 3.29,
      giaMess: 7500,
      cps: 216000,
      cpds: 7.5,
      giaTBDon: 287273
    },
    {
      team: 'Team Beta',
      name: 'Dinh Van L',
      email: 'l.marketing@example.com',
      soMess: 1200,
      cpqc: 9000,
      soDon: 43,
      soDonTT: 41,
      dsChot: 12000000,
      dsChotTT: 11500000,
      tiLeChot: 3.58,
      tiLeChotTT: 3.42,
      giaMess: 9000,
      cps: 251163,
      cpds: 9.0,
      giaTBDon: 279070
    },
    {
      team: 'Team Gamma',
      name: 'Truong Thi M',
      email: 'm.marketing@example.com',
      soMess: 1450,
      cpqc: 8000,
      soDon: 51,
      soDonTT: 48,
      dsChot: 14500000,
      dsChotTT: 13900000,
      tiLeChot: 3.52,
      tiLeChotTT: 3.31,
      giaMess: 8000,
      cps: 227451,
      cpds: 8.0,
      giaTBDon: 284314
    }
  ];

  // Calculate Ads Metrics for table
  const adsMetrics = useMemo(() => {
    // Use mock data if no real data available
    if (employeeReports.length === 0) {
      return mockAdsMetrics;
    }
    
    return employeeReports.map((emp): AdsMetrics => {
      const soMess = emp.totalData;
      const cpqc = soMess > 0 ? emp.adsCost / soMess : 0;
      const soDon = emp.closedData;
      const soDonTT = soDon; // Tạm thời dùng cùng giá trị
      const dsChot = emp.totalRevenue;
      const dsChotTT = dsChot; // Tạm thời dùng cùng giá trị
      const tiLeChot = soMess > 0 ? (soDon / soMess) * 100 : 0;
      const tiLeChotTT = tiLeChot; // Tạm thời dùng cùng giá trị
      const giaMess = soMess > 0 ? emp.adsCost / soMess : 0;
      const cps = soDon > 0 ? emp.adsCost / soDon : 0;
      const cpds = dsChot > 0 ? (emp.adsCost / dsChot) * 100 : 0;
      const giaTBDon = soDon > 0 ? dsChot / soDon : 0;

      return {
        team: emp.team,
        name: emp.name,
        email: emp.email,
        soMess,
        cpqc,
        soDon,
        soDonTT,
        dsChot,
        dsChotTT,
        tiLeChot,
        tiLeChotTT,
        giaMess,
        cps,
        cpds,
        giaTBDon
      };
    });
  }, [employeeReports]);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('vi-VN');
  };

  const formatPercentage = (value: number) => {
    return value.toFixed(2).replace('.', ',') + '%';
  };

  // Project names for metric cards
  const projects = [
    { name: 'Project Alpha', color: 'indigo' },
    { name: 'Project Beta', color: 'purple' },
    { name: 'Project Gamma', color: 'emerald' }
  ];

  // Daily Report Data
  const dailyReportData = [
    { date: '07-01', day: 'Thứ 6', marketingExpenses: 250423784, impression: 1591512, cpm: 157350, comments: 854, commentsPerImp: 0.05, costPerComment: 293236, newMessages: 1730, newMessagesPerImp: 0.11, costPerNewMessage: 144754, sales: 64, salesPerImp: 0.0040, costPerSale: 3912872 },
    { date: '08-01', day: 'Thứ 7', marketingExpenses: 382486714, impression: 2335025, cpm: 163804, comments: 1106, commentsPerImp: 0.05, costPerComment: 345829, newMessages: 1926, newMessagesPerImp: 0.08, costPerNewMessage: 198591, sales: 94, salesPerImp: 0.0040, costPerSale: 4069008 },
    { date: '09-01', day: 'CN', marketingExpenses: 546281174, impression: 2965222, cpm: 184229, comments: 1235, commentsPerImp: 0.04, costPerComment: 442333, newMessages: 2180, newMessagesPerImp: 0.07, costPerNewMessage: 250588, sales: 0, salesPerImp: 0.0000, costPerSale: 0 },
    { date: '10-01', day: 'Thứ 2', marketingExpenses: 385118635, impression: 2050424, cpm: 187824, comments: 982, commentsPerImp: 0.05, costPerComment: 392178, newMessages: 2172, newMessagesPerImp: 0.11, costPerNewMessage: 177311, sales: 284, salesPerImp: 0.0139, costPerSale: 1356052 },
    { date: '11-01', day: 'Thứ 3', marketingExpenses: 215288151, impression: 1308892, cpm: 164481, comments: 1111, commentsPerImp: 0.08, costPerComment: 193779, newMessages: 3033, newMessagesPerImp: 0.23, costPerNewMessage: 70982, sales: 229, salesPerImp: 0.0175, costPerSale: 940123 },
    { date: '12-01', day: 'Thứ 4', marketingExpenses: 0, impression: 0, cpm: 0, comments: 0, commentsPerImp: 0, costPerComment: 0, newMessages: 0, newMessagesPerImp: 0, costPerNewMessage: 0, sales: 0, salesPerImp: 0, costPerSale: 0 },
    { date: '13-01', day: 'Thứ 5', marketingExpenses: 0, impression: 0, cpm: 0, comments: 0, commentsPerImp: 0, costPerComment: 0, newMessages: 0, newMessagesPerImp: 0, costPerNewMessage: 0, sales: 0, salesPerImp: 0, costPerSale: 0 },
    { date: '14-01', day: 'Thứ 6', marketingExpenses: 0, impression: 0, cpm: 0, comments: 0, commentsPerImp: 0, costPerComment: 0, newMessages: 0, newMessagesPerImp: 0, costPerNewMessage: 0, sales: 0, salesPerImp: 0, costPerSale: 0 },
    { date: '15-01', day: 'Thứ 7', marketingExpenses: 0, impression: 0, cpm: 0, comments: 0, commentsPerImp: 0, costPerComment: 0, newMessages: 0, newMessagesPerImp: 0, costPerNewMessage: 0, sales: 0, salesPerImp: 0, costPerSale: 0 },
    { date: '16-01', day: 'CN', marketingExpenses: 0, impression: 0, cpm: 0, comments: 0, commentsPerImp: 0, costPerComment: 0, newMessages: 0, newMessagesPerImp: 0, costPerNewMessage: 0, sales: 0, salesPerImp: 0, costPerSale: 0 },
  ];

  const dailyReportTotals = dailyReportData.reduce((acc, day) => ({
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
    marketingExpenses: 0,
    impression: 0,
    cpm: 0,
    comments: 0,
    commentsPerImp: 0,
    costPerComment: 0,
    newMessages: 0,
    newMessagesPerImp: 0,
    costPerNewMessage: 0,
    sales: 0,
    salesPerImp: 0,
    costPerSale: 0,
  });

  // Calculate averages for totals
  const avgCpm = dailyReportTotals.impression > 0 ? (dailyReportTotals.marketingExpenses / dailyReportTotals.impression) * 1000 : 0;
  const avgCommentsPerImp = dailyReportTotals.impression > 0 ? (dailyReportTotals.comments / dailyReportTotals.impression) * 100 : 0;
  const avgCostPerComment = dailyReportTotals.comments > 0 ? dailyReportTotals.marketingExpenses / dailyReportTotals.comments : 0;
  const avgNewMessagesPerImp = dailyReportTotals.impression > 0 ? (dailyReportTotals.newMessages / dailyReportTotals.impression) * 100 : 0;
  const avgCostPerNewMessage = dailyReportTotals.newMessages > 0 ? dailyReportTotals.marketingExpenses / dailyReportTotals.newMessages : 0;
  const avgSalesPerImp = dailyReportTotals.impression > 0 ? (dailyReportTotals.sales / dailyReportTotals.impression) * 100 : 0;
  const avgCostPerSale = dailyReportTotals.sales > 0 ? dailyReportTotals.marketingExpenses / dailyReportTotals.sales : 0;

  // Weekly Report Data
  const weeklyReportData = [
    { week: '07-01\n13-01', endDate: '13-01', me: 1779598458, impression: 10251075, cpm: 173601, comments: 5288, commentsPerImp: 0.05, costPerComment: 336535, newMessages: 11041, newMessagesPerImp: 0.11, costPerNewMessage: 161181, sales: 671, salesPerImp: 0.0065, costPerSale: 2652159 },
    { week: '14-01\n20-01', endDate: '20-01', me: 0, impression: 0, cpm: 0, comments: 0, commentsPerImp: 0, costPerComment: 0, newMessages: 0, newMessagesPerImp: 0, costPerNewMessage: 0, sales: 0, salesPerImp: 0, costPerSale: 0 },
    { week: '21-01\n27-01', endDate: '27-01', me: 0, impression: 0, cpm: 0, comments: 0, commentsPerImp: 0, costPerComment: 0, newMessages: 0, newMessagesPerImp: 0, costPerNewMessage: 0, sales: 0, salesPerImp: 0, costPerSale: 0 },
    { week: '28-01\n03-02', endDate: '03-02', me: 0, impression: 0, cpm: 0, comments: 0, commentsPerImp: 0, costPerComment: 0, newMessages: 0, newMessagesPerImp: 0, costPerNewMessage: 0, sales: 0, salesPerImp: 0, costPerSale: 0 },
    { week: '04-02\n10-02', endDate: '10-02', me: 0, impression: 0, cpm: 0, comments: 0, commentsPerImp: 0, costPerComment: 0, newMessages: 0, newMessagesPerImp: 0, costPerNewMessage: 0, sales: 0, salesPerImp: 0, costPerSale: 0 },
    { week: '11-02\n17-02', endDate: '17-02', me: 0, impression: 0, cpm: 0, comments: 0, commentsPerImp: 0, costPerComment: 0, newMessages: 0, newMessagesPerImp: 0, costPerNewMessage: 0, sales: 0, salesPerImp: 0, costPerSale: 0 },
    { week: '18-02\n24-02', endDate: '24-02', me: 0, impression: 0, cpm: 0, comments: 0, commentsPerImp: 0, costPerComment: 0, newMessages: 0, newMessagesPerImp: 0, costPerNewMessage: 0, sales: 0, salesPerImp: 0, costPerSale: 0 },
    { week: '25-02\n03-03', endDate: '03-03', me: 0, impression: 0, cpm: 0, comments: 0, commentsPerImp: 0, costPerComment: 0, newMessages: 0, newMessagesPerImp: 0, costPerNewMessage: 0, sales: 0, salesPerImp: 0, costPerSale: 0 },
    { week: '04-03\n10-03', endDate: '10-03', me: 0, impression: 0, cpm: 0, comments: 0, commentsPerImp: 0, costPerComment: 0, newMessages: 0, newMessagesPerImp: 0, costPerNewMessage: 0, sales: 0, salesPerImp: 0, costPerSale: 0 },
  ];

  const weeklyReportTotals = weeklyReportData.reduce((acc, week) => ({
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
    me: 0,
    impression: 0,
    cpm: 0,
    comments: 0,
    commentsPerImp: 0,
    costPerComment: 0,
    newMessages: 0,
    newMessagesPerImp: 0,
    costPerNewMessage: 0,
    sales: 0,
    salesPerImp: 0,
    costPerSale: 0,
  });

  const weeklyAvgCpm = weeklyReportTotals.impression > 0 ? (weeklyReportTotals.me / weeklyReportTotals.impression) * 1000 : 0;
  const weeklyAvgCommentsPerImp = weeklyReportTotals.impression > 0 ? (weeklyReportTotals.comments / weeklyReportTotals.impression) * 100 : 0;
  const weeklyAvgCostPerComment = weeklyReportTotals.comments > 0 ? weeklyReportTotals.me / weeklyReportTotals.comments : 0;
  const weeklyAvgNewMessagesPerImp = weeklyReportTotals.impression > 0 ? (weeklyReportTotals.newMessages / weeklyReportTotals.impression) * 100 : 0;
  const weeklyAvgCostPerNewMessage = weeklyReportTotals.newMessages > 0 ? weeklyReportTotals.me / weeklyReportTotals.newMessages : 0;
  const weeklyAvgSalesPerImp = weeklyReportTotals.impression > 0 ? (weeklyReportTotals.sales / weeklyReportTotals.impression) * 100 : 0;
  const weeklyAvgCostPerSale = weeklyReportTotals.sales > 0 ? weeklyReportTotals.me / weeklyReportTotals.sales : 0;

  // Monthly Report Data
  const monthlyReportData = [
    { month: '01-01', endDate: '31-01', me: 1779598458, impression: 10251075, cpm: 173601, comments: 5288, commentsPerImp: 0.05, costPerComment: 336535, newMessages: 11041, newMessagesPerImp: 0.11, costPerNewMessage: 161181, sales: 671, salesPerImp: 0.0065, costPerSale: 2652159 },
    { month: '01-02', endDate: '28-02', me: 0, impression: 0, cpm: 0, comments: 0, commentsPerImp: 0, costPerComment: 0, newMessages: 0, newMessagesPerImp: 0, costPerNewMessage: 0, sales: 0, salesPerImp: 0, costPerSale: 0 },
    { month: '01-03', endDate: '31-03', me: 0, impression: 0, cpm: 0, comments: 0, commentsPerImp: 0, costPerComment: 0, newMessages: 0, newMessagesPerImp: 0, costPerNewMessage: 0, sales: 0, salesPerImp: 0, costPerSale: 0 },
    { month: '01-04', endDate: '30-04', me: 0, impression: 0, cpm: 0, comments: 0, commentsPerImp: 0, costPerComment: 0, newMessages: 0, newMessagesPerImp: 0, costPerNewMessage: 0, sales: 0, salesPerImp: 0, costPerSale: 0 },
    { month: '01-05', endDate: '31-05', me: 0, impression: 0, cpm: 0, comments: 0, commentsPerImp: 0, costPerComment: 0, newMessages: 0, newMessagesPerImp: 0, costPerNewMessage: 0, sales: 0, salesPerImp: 0, costPerSale: 0 },
    { month: '01-06', endDate: '30-06', me: 0, impression: 0, cpm: 0, comments: 0, commentsPerImp: 0, costPerComment: 0, newMessages: 0, newMessagesPerImp: 0, costPerNewMessage: 0, sales: 0, salesPerImp: 0, costPerSale: 0 },
    { month: '01-07', endDate: '31-07', me: 0, impression: 0, cpm: 0, comments: 0, commentsPerImp: 0, costPerComment: 0, newMessages: 0, newMessagesPerImp: 0, costPerNewMessage: 0, sales: 0, salesPerImp: 0, costPerSale: 0 },
    { month: '01-08', endDate: '31-08', me: 0, impression: 0, cpm: 0, comments: 0, commentsPerImp: 0, costPerComment: 0, newMessages: 0, newMessagesPerImp: 0, costPerNewMessage: 0, sales: 0, salesPerImp: 0, costPerSale: 0 },
    { month: '01-09', endDate: '30-09', me: 0, impression: 0, cpm: 0, comments: 0, commentsPerImp: 0, costPerComment: 0, newMessages: 0, newMessagesPerImp: 0, costPerNewMessage: 0, sales: 0, salesPerImp: 0, costPerSale: 0 },
    { month: '01-10', endDate: '31-10', me: 0, impression: 0, cpm: 0, comments: 0, commentsPerImp: 0, costPerComment: 0, newMessages: 0, newMessagesPerImp: 0, costPerNewMessage: 0, sales: 0, salesPerImp: 0, costPerSale: 0 },
    { month: '01-11', endDate: '30-11', me: 0, impression: 0, cpm: 0, comments: 0, commentsPerImp: 0, costPerComment: 0, newMessages: 0, newMessagesPerImp: 0, costPerNewMessage: 0, sales: 0, salesPerImp: 0, costPerSale: 0 },
    { month: '01-12', endDate: '31-12', me: 0, impression: 0, cpm: 0, comments: 0, commentsPerImp: 0, costPerComment: 0, newMessages: 0, newMessagesPerImp: 0, costPerNewMessage: 0, sales: 0, salesPerImp: 0, costPerSale: 0 },
  ];

  const monthlyReportTotals = monthlyReportData.reduce((acc, month) => ({
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
    me: 0,
    impression: 0,
    cpm: 0,
    comments: 0,
    commentsPerImp: 0,
    costPerComment: 0,
    newMessages: 0,
    newMessagesPerImp: 0,
    costPerNewMessage: 0,
    sales: 0,
    salesPerImp: 0,
    costPerSale: 0,
  });

  const monthlyAvgCpm = monthlyReportTotals.impression > 0 ? (monthlyReportTotals.me / monthlyReportTotals.impression) * 1000 : 0;
  const monthlyAvgCommentsPerImp = monthlyReportTotals.impression > 0 ? (monthlyReportTotals.comments / monthlyReportTotals.impression) * 100 : 0;
  const monthlyAvgCostPerComment = monthlyReportTotals.comments > 0 ? monthlyReportTotals.me / monthlyReportTotals.comments : 0;
  const monthlyAvgNewMessagesPerImp = monthlyReportTotals.impression > 0 ? (monthlyReportTotals.newMessages / monthlyReportTotals.impression) * 100 : 0;
  const monthlyAvgCostPerNewMessage = monthlyReportTotals.newMessages > 0 ? monthlyReportTotals.me / monthlyReportTotals.newMessages : 0;
  const monthlyAvgSalesPerImp = monthlyReportTotals.impression > 0 ? (monthlyReportTotals.sales / monthlyReportTotals.impression) * 100 : 0;
  const monthlyAvgCostPerSale = monthlyReportTotals.sales > 0 ? monthlyReportTotals.me / monthlyReportTotals.sales : 0;

  const searchTerms: SearchTerm[] = [
    {
      id: 1,
      term: 'heo quay',
      matchType: 'Exact',
      conversions: 3,
      costPerConv: '132.085,2 ₫',
      convRate: '6,52%',
      cost: '396,26 N ₫',
      clicks: 46,
      avgCPC: '8.614,25 ₫',
      ctr: '5,56%',
      impressions: 227,
      avgCPM: '479.148 ₫'
    },
    {
      id: 2,
      term: 'heo quay ng...',
      matchType: 'Exact',
      conversions: 2,
      costPerConv: '98.678,89 ₫',
      convRate: '6,67%',
      cost: '197,36 N ₫',
      clicks: 30,
      avgCPC: '6.578,59 ₫',
      ctr: '10,34%',
      impressions: 290,
      avgCPM: '680.544 ₫'
    },
    {
      id: 3,
      term: 'heo sữa quay',
      matchType: 'Exact',
      conversions: 0.5,
      costPerConv: '348.052,37 ₫',
      convRate: '3,33%',
      cost: '174,03 N ₫',
      clicks: 16,
      avgCPC: '10.876,64 ₫',
      ctr: '3,45%',
      impressions: 464,
      avgCPM: '375.056 ₫'
    },
    {
      id: 4,
      term: 'heo quay vin...',
      matchType: 'Exact',
      conversions: 0,
      costPerConv: '0 ₫',
      convRate: '0%',
      cost: '168,9 N ₫',
      clicks: 21,
      avgCPC: '8.043 ₫',
      ctr: '8,79%',
      impressions: 239,
      avgCPM: '706.707 ₫'
    },
    {
      id: 5,
      term: 'heo quay ki...',
      matchType: 'Exact',
      conversions: 2.5,
      costPerConv: '66.852,48 ₫',
      convRate: '11,56%',
      cost: '167,13 N ₫',
      clicks: 22,
      avgCPC: '7.596,87 ₫',
      ctr: '6,49%',
      impressions: 339,
      avgCPM: '493.012 ₫'
    },
    {
      id: 6,
      term: 'heo quay bin...',
      matchType: 'Exact',
      conversions: 2,
      costPerConv: '73.274,5 ₫',
      convRate: '15,38%',
      cost: '146,55 N ₫',
      clicks: 13,
      avgCPC: '11.273 ₫',
      ctr: '19,12%',
      impressions: 68,
      avgCPM: '2.155.132 ₫'
    },
    {
      id: 7,
      term: 'heo sữa quay...',
      matchType: 'Exact',
      conversions: 2,
      costPerConv: '68.962,19 ₫',
      convRate: '9,09%',
      cost: '137,92 N ₫',
      clicks: 22,
      avgCPC: '6.269,29 ₫',
      ctr: '12,43%',
      impressions: 177,
      avgCPM: '779.234 ₫'
    },
    {
      id: 8,
      term: 'heo quay ph...',
      matchType: 'Exact',
      conversions: 1,
      costPerConv: '127.115,38 ₫',
      convRate: '6,25%',
      cost: '127,12 N ₫',
      clicks: 16,
      avgCPC: '7.944,71 ₫',
      ctr: '5,65%',
      impressions: 283,
      avgCPM: '449.171 ₫'
    },
    {
      id: 9,
      term: 'vịt quay vinh...',
      matchType: 'Phrase (close...)',
      conversions: 2,
      costPerConv: '62.304,23 ₫',
      convRate: '13,33%',
      cost: '124,61 N ₫',
      clicks: 15,
      avgCPC: '8.307,23 ₫',
      ctr: '4,42%',
      impressions: 339,
      avgCPM: '367.577 ₫'
    },
    {
      id: 10,
      term: 'heo quay hu...',
      matchType: 'Phrase (close...)',
      conversions: 4.3,
      costPerConv: '24.374,17 ₫',
      convRate: '39,39%',
      cost: '105,62 N ₫',
      clicks: 11,
      avgCPC: '9.601,94 ₫',
      ctr: '12,5%',
      impressions: 88,
      avgCPM: '1.200.243 ₫'
    },
    {
      id: 11,
      term: 'heo quay gá...',
      matchType: 'Exact',
      conversions: 2.3,
      costPerConv: '39.409,27 ₫',
      convRate: '23,33%',
      cost: '91,96 N ₫',
      clicks: 10,
      avgCPC: '9.195,5 ₫',
      ctr: '4,67%',
      impressions: 214,
      avgCPM: '429.696 ₫'
    }
  ];

  const totalConversions = 260.9;
  const totalCostPerConv = '64.093,87 ₫';
  const totalConvRate = '5,6%';
  const totalCost = '16,72 Tr ₫';
  const totalClicks = 4700;
  const totalAvgCPC = '3.590,83 ₫';
  const totalCTR = '3,64%';
  const totalImpressions = 127835;
  const totalAvgCPM = '130.785 ₫';

  // Chart data for line charts
  const impressionsData = [4622, 5400, 4080, 4980, 5158, 5011, 6431];
  const clicksData = [291, 256, 234, 304, 254, 300, 260];
  const conversionsData = [25, 26, 18, 45, 61, 41, 18];
  const chartDates = ['21 thg 2, 2026', '22 thg 2, 2026', '23 thg 2, 2026', '24 thg 2, 2026', '25 thg 2, 2026', '26 thg 2, 2026', '27 thg 2, 2026'];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[130] bg-ads-navy text-gray-200 font-sans flex flex-col overflow-hidden"
    >
      {/* Top Header */}
      <header className="h-16 bg-white flex items-center justify-between px-6 border-b border-gray-200 sticky top-0 z-50">
        <div className="flex items-center space-x-4">
          <span className="text-gray-600 font-medium text-lg">Chỉ số MKT | VPFLY</span>
          <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm flex items-center space-x-1">
            <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
            <span>Phiên bản đã xuất bản</span>
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-center space-x-6">
          <button className="text-gray-500 hover:text-gray-700">
            <MoreVertical className="w-6 h-6" />
          </button>
          <button className="text-gray-500 hover:text-gray-700">
            <HelpCircle className="w-6 h-6" />
          </button>
          <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-300">
            <img
              alt="Profile"
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuD-e39EyUaJ-yTEZSvPj5LizafycuV-X5Zjjl2Nb8Nst7AyJuWB5rg0qNfK8cMUnLxzYzjY91AbahZW4bIZixwORzzj2N6Qy-2E32Ae-SGZR8D2sK9M9Ws1LpoVSThWyVx7HOTteOdrUO1NRn34-bmNf-pLTcpM0Uv7B-roRR1QTbkEeYnupvNv4OKuxyIbf4wgnRGDaIitvpNE03KHohuJ3P4bVzmk4dLlhSetUr6m7uD2UfR27oxOMsgjA5Big2t_mTpHqe4HL4rE"
            />
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-64 bg-ads-sidebar shrink-0 p-4 space-y-6 hidden md:block overflow-y-auto custom-scrollbar">
          <div className="text-xs uppercase text-gray-500 font-bold tracking-widest px-2">Chỉ số MKT</div>
          <nav className="space-y-1">
            <a className="flex items-center space-x-3 px-3 py-2 text-gray-400 hover:bg-ads-active hover:text-white rounded-lg transition" href="#">
              <Home className="w-5 h-5" />
              <span className="font-medium">Overview</span>
            </a>
            <div className="space-y-1 pt-2">
              <div className="flex items-center justify-between px-3 py-2 text-white bg-ads-active rounded-lg">
                <div className="flex items-center space-x-3">
                  <Layout className="w-5 h-5" />
                  <span className="font-medium">Campaigns</span>
                </div>
                <ChevronDown className="w-4 h-4 rotate-180" />
              </div>
              <div className="pl-11 space-y-1 pt-2">
                <button
                  onClick={() => setActiveTab('employee-report')}
                  className={`block py-2 text-sm w-full text-left transition ${
                    activeTab === 'employee-report'
                      ? 'text-white bg-ads-active px-2 rounded'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Chi tiết chỉ số ads
                </button>
              </div>
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Secondary Header */}
          <div className="bg-[#1e2154] p-4 border-b border-gray-700">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="bg-white p-2 rounded-lg">
                  <span className="text-lg font-bold text-gray-800">FLY</span>
                </div>
                <div className="flex items-center space-x-2">
                  <img
                    alt="Facebook Ads Logo"
                    className="rounded-sm h-6"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuCf7lwH1jYAlqcmPIsSuKGqNye5elhR-81mPJ5eMc9IwTKZJyvk0K_oMq1D5ma076nKmDaoTCWs2XRXEBqG6_pMalsufLemlMk29j92WkNvoX5hm0KIkNmC4fN9ahJFldN262N8lzzPzAoVaZ-X2_HZlzQrcxTcJx1wtSDYNiVGWXS8thdA9-madAkkjipQYxCVOk2z843UW2nMPQfPymT50gmde1DtyILB7lq1DPJW3lCPHdy8Lbr9T5rHOxe70aYpcsYwitwRRjR9"
                  />
                  <span className="text-xl font-bold">Chỉ số MKT</span>
                </div>
              </div>
              <div className="flex items-center space-x-4 flex-wrap">
                <div className="bg-[#0f1134] px-4 py-2 rounded-lg flex items-center space-x-2 border border-gray-600 cursor-pointer hover:bg-[#13153c] transition">
                  <div className="w-6 h-6 bg-pink-500 rounded-full flex items-center justify-center text-[10px]">
                    <span className="text-white">!</span>
                  </div>
                  <span className="text-sm">heoquay.vn</span>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </div>
                <div className="bg-[#0f1134] px-4 py-2 rounded-lg border border-gray-600 flex items-center space-x-2 cursor-pointer hover:bg-[#13153c] transition">
                  <span className="text-sm">1 thg 1, 2026 - 31 thg 1, 2026</span>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            </div>
            
            {/* Filters */}
            <div className="flex flex-wrap gap-4 mt-4">
              <div className="bg-[#1a1c4e] px-4 py-2 rounded border border-gray-600 text-sm flex items-center justify-between min-w-[200px] cursor-pointer hover:bg-[#1d1e45] transition">
                <span className="text-gray-400">Advertising channel type</span>
                <ChevronDown className="w-4 h-4" />
              </div>
              <div className="bg-[#1a1c4e] px-4 py-2 rounded border border-gray-600 text-sm flex items-center justify-between min-w-[200px] cursor-pointer hover:bg-[#1d1e45] transition">
                <span className="text-gray-400">Bid Strategy</span>
                <ChevronDown className="w-4 h-4" />
              </div>
              <div className="bg-[#1a1c4e] px-4 py-2 rounded border border-gray-600 text-sm flex items-center justify-between min-w-[200px] cursor-pointer hover:bg-[#1d1e45] transition">
                <span className="text-gray-400">Campaign</span>
                <ChevronDown className="w-4 h-4" />
              </div>
              <div className="bg-[#1a1c4e] px-4 py-2 rounded border border-gray-600 text-sm flex items-center justify-between min-w-[200px] cursor-pointer hover:bg-[#1d1e45] transition">
                <span className="text-gray-400">Campaign status</span>
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Content Body */}
          <div className="p-6 bg-[#090b24] flex-1 overflow-y-auto custom-scrollbar">
            {/* Tabs */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  activeTab === 'overview'
                    ? 'bg-ads-active text-white'
                    : 'bg-[#1a1c4e] text-gray-400 hover:text-white'
                }`}
              >
                Tổng quan
              </button>
              <button
                onClick={() => setActiveTab('map')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  activeTab === 'map'
                    ? 'bg-ads-active text-white'
                    : 'bg-[#1a1c4e] text-gray-400 hover:text-white'
                }`}
              >
                Bản đồ Đông Nam Á
              </button>
            </div>

            {activeTab === 'overview' ? (
              <>
                {/* Metric Cards */}
                <div className="grid grid-cols-2 gap-0 mb-8">
              {/* Project Alpha Card */}
              <div className="bg-ads-card rounded-xl p-3 border-t-4 border-indigo-500 flex flex-col">
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs uppercase text-gray-400 font-bold">{projects[0].name}</div>
                    <div className="text-[10px] text-red-500 bg-red-900/30 w-fit px-2 py-0.5 rounded flex items-center">
                      <ChevronDown className="w-2 h-2 mr-1" />
                      -18.9%
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-gray-500">Impressions</span>
                    <span className="text-3xl font-bold">127,8 N</span>
                  </div>
                </div>
                
                <div className="mb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-gray-400 mb-0.5">Search Impr. share</div>
                      <div className="text-base font-semibold mb-1">28%</div>
                      <div className="w-full h-1 bg-gray-700 rounded-full">
                        <div className="w-[40.4%] h-full bg-red-500 rounded-full"></div>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <div className="text-[10px] text-gray-400 mb-0.5">Search Exact match IS</div>
                      <div className="text-base font-semibold mb-1">44%</div>
                      <div className="w-full h-1 bg-gray-700 rounded-full">
                        <div className="w-[73.0%] h-full bg-emerald-500 rounded-full ml-auto"></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Charts Row */}
                <div className="mt-auto flex gap-2">
                  {/* Line Chart */}
                  <div className="flex-1">
                    <div className="text-[10px] text-gray-400 mb-1">Impressions</div>
                    <div className="h-16 relative">
                    <svg className="w-full h-full" viewBox="0 0 400 100" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="impressionsGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {(() => {
                        const maxVal = Math.max(...impressionsData);
                        const points = impressionsData.map((val, idx) => ({
                          x: (idx / (impressionsData.length - 1)) * 400,
                          y: 100 - (val / maxVal) * 80
                        }));
                        
                        // Tạo smooth curve với cubic bezier
                        const createSmoothPath = (points: {x: number, y: number}[]) => {
                          if (points.length < 2) return '';
                          let path = `M ${points[0].x},${points[0].y}`;
                          for (let i = 0; i < points.length - 1; i++) {
                            const p0 = points[Math.max(0, i - 1)];
                            const p1 = points[i];
                            const p2 = points[i + 1];
                            const p3 = points[Math.min(points.length - 1, i + 2)];
                            
                            const cp1x = p1.x + (p2.x - p0.x) / 6;
                            const cp1y = p1.y + (p2.y - p0.y) / 6;
                            const cp2x = p2.x - (p3.x - p1.x) / 6;
                            const cp2y = p2.y - (p3.y - p1.y) / 6;
                            
                            path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
                          }
                          return path;
                        };
                        
                        const smoothPath = createSmoothPath(points);
                        const fillPath = `${smoothPath} L 400,100 L 0,100 Z`;
                        return (
                          <>
                            <path d={fillPath} fill="url(#impressionsGradient)" />
                            <path
                              d={smoothPath}
                              fill="none"
                              stroke="#3b82f6"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                            />
                            {points.map((point, idx) => (
                              <g key={idx}>
                                <circle cx={point.x} cy={point.y} r="2.5" fill="#3b82f6" />
                                <text
                                  x={point.x}
                                  y={point.y - 6}
                                  textAnchor="middle"
                                  fill="#ffffff"
                                  fontSize="9"
                                  fontWeight="500"
                                >
                                  {impressionsData[idx].toLocaleString()}
                                </text>
                              </g>
                            ))}
                          </>
                        );
                      })()}
                    </svg>
                    <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[8px] text-gray-400 px-1">
                      {chartDates.map((date, idx) => (
                        <span key={idx} className="text-center" style={{ width: `${100 / chartDates.length}%` }}>
                          {date}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Donut Chart */}
                  <div className="w-20 flex-shrink-0">
                    <div className="text-[10px] text-gray-400 mb-1">Distribution</div>
                    <div className="h-16 relative flex items-center justify-center">
                      <svg className="w-full h-full" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="35" fill="none" stroke="#1e293b" strokeWidth="8" />
                        <circle
                          cx="50"
                          cy="50"
                          r="35"
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="8"
                          strokeDasharray={`${65 * 2 * Math.PI * 35 / 100} ${2 * Math.PI * 35}`}
                          strokeDashoffset="0"
                          transform="rotate(-90 50 50)"
                        />
                        <text x="50" y="48" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold">65%</text>
                        <text x="50" y="58" textAnchor="middle" fill="#9ca3af" fontSize="8">Share</text>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Project Beta Card */}
              <div className="bg-ads-card rounded-xl p-3 border-t-4 border-purple-600 flex flex-col">
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs uppercase text-gray-400 font-bold">{projects[1].name}</div>
                    <div className="text-[10px] text-red-500 bg-red-900/30 w-fit px-2 py-0.5 rounded flex items-center">
                      <ChevronDown className="w-2 h-2 mr-1" />
                      -4.9%
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-gray-500">Clicks</span>
                    <span className="text-3xl font-bold">4,7 N</span>
                  </div>
                </div>
                
                <div className="mb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-gray-400 mb-0.5">CTR</div>
                      <div className="text-base font-semibold mb-1">3,64%</div>
                      <div className="w-full h-1 bg-gray-700 rounded-full">
                        <div className="w-[72.8%] h-full bg-emerald-500 rounded-full"></div>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <div className="text-[10px] text-gray-400 mb-0.5">Avg. CPC</div>
                      <div className="text-base font-semibold mb-1">3.591 ₫</div>
                      <div className="w-full h-1 bg-gray-700 rounded-full">
                        <div className="w-[35.9%] h-full bg-emerald-500 rounded-full ml-auto"></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Charts Row */}
                <div className="mt-auto flex gap-2">
                  {/* Line Chart */}
                  <div className="flex-1">
                    <div className="text-[10px] text-gray-400 mb-1">Clicks</div>
                    <div className="h-16 relative">
                      <svg className="w-full h-full" viewBox="0 0 400 100" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="clicksGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        {(() => {
                          const maxVal = Math.max(...clicksData);
                          const points = clicksData.map((val, idx) => ({
                            x: (idx / (clicksData.length - 1)) * 400,
                            y: 100 - (val / maxVal) * 80
                          }));
                          
                          // Tạo smooth curve với cubic bezier
                          const createSmoothPath = (points: {x: number, y: number}[]) => {
                            if (points.length < 2) return '';
                            let path = `M ${points[0].x},${points[0].y}`;
                            for (let i = 0; i < points.length - 1; i++) {
                              const p0 = points[Math.max(0, i - 1)];
                              const p1 = points[i];
                              const p2 = points[i + 1];
                              const p3 = points[Math.min(points.length - 1, i + 2)];
                              
                              const cp1x = p1.x + (p2.x - p0.x) / 6;
                              const cp1y = p1.y + (p2.y - p0.y) / 6;
                              const cp2x = p2.x - (p3.x - p1.x) / 6;
                              const cp2y = p2.y - (p3.y - p1.y) / 6;
                              
                              path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
                            }
                            return path;
                          };
                          
                          const smoothPath = createSmoothPath(points);
                          const fillPath = `${smoothPath} L 400,100 L 0,100 Z`;
                          return (
                            <>
                              <path d={fillPath} fill="url(#clicksGradient)" />
                              <path
                                d={smoothPath}
                                fill="none"
                                stroke="#a855f7"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                              />
                              {points.map((point, idx) => (
                                <g key={idx}>
                                  <circle cx={point.x} cy={point.y} r="2.5" fill="#a855f7" />
                                  <text
                                    x={point.x}
                                    y={point.y - 6}
                                    textAnchor="middle"
                                    fill="#ffffff"
                                    fontSize="9"
                                    fontWeight="500"
                                  >
                                    {clicksData[idx]}
                                  </text>
                                </g>
                              ))}
                            </>
                          );
                        })()}
                      </svg>
                      <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[8px] text-gray-400 px-1">
                        {chartDates.map((date, idx) => (
                          <span key={idx} className="text-center" style={{ width: `${100 / chartDates.length}%` }}>
                            {date}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Donut Chart */}
                  <div className="w-20 flex-shrink-0">
                    <div className="text-[10px] text-gray-400 mb-1">Distribution</div>
                    <div className="h-16 relative flex items-center justify-center">
                      <svg className="w-full h-full" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="35" fill="none" stroke="#1e293b" strokeWidth="8" />
                        <circle
                          cx="50"
                          cy="50"
                          r="35"
                          fill="none"
                          stroke="#a855f7"
                          strokeWidth="8"
                          strokeDasharray={`${72 * 2 * Math.PI * 35 / 100} ${2 * Math.PI * 35}`}
                          strokeDashoffset="0"
                          transform="rotate(-90 50 50)"
                        />
                        <text x="50" y="48" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold">72%</text>
                        <text x="50" y="58" textAnchor="middle" fill="#9ca3af" fontSize="8">Share</text>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Project Gamma Card */}
              <div className="bg-ads-card rounded-xl p-3 border-t-4 border-emerald-500 flex flex-col">
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="text-xs uppercase text-gray-400 font-bold">{projects[2].name}</div>
                      <div className="w-12 h-12 relative">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                          <circle
                            cx="50"
                            cy="50"
                            fill="none"
                            r="40"
                            stroke="#1e293b"
                            strokeWidth="12"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            fill="none"
                            r="40"
                            stroke="#ff4d8d"
                            strokeDasharray={`${75 * 2.512} ${251.2}`}
                            strokeWidth="12"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <div className="text-[8px] text-gray-400">Cost</div>
                          <div className="text-[10px] font-bold">16,72 Tr ₫</div>
                          <div className="text-[8px] text-red-500">-026%</div>
                        </div>
                      </div>
                    </div>
                    <div className="text-[10px] text-red-500 bg-red-900/30 w-fit px-2 py-0.5 rounded flex items-center">
                      <ChevronDown className="w-2 h-2 mr-1" />
                      -3.4%
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-gray-500">Conversions</span>
                    <span className="text-3xl font-bold">261</span>
                  </div>
                </div>
                
                <div className="mb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-gray-400 mb-0.5">Conv. rate</div>
                      <div className="text-base font-semibold mb-1">5,60%</div>
                      <div className="w-full h-1 bg-gray-700 rounded-full">
                        <div className="w-[186.7%] h-full bg-emerald-500 rounded-full max-w-full"></div>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <div className="text-[10px] text-gray-400 mb-0.5">Cost / conv.</div>
                      <div className="text-base font-semibold mb-1">64.094 ₫</div>
                      <div className="w-full h-1 bg-gray-700 rounded-full">
                        <div className="w-[128.2%] h-full bg-emerald-500 rounded-full max-w-full ml-auto"></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Charts Row */}
                <div className="mt-auto flex gap-2">
                  {/* Line Chart */}
                  <div className="flex-1">
                    <div className="text-[10px] text-gray-400 mb-1">Conversions</div>
                    <div className="h-16 relative">
                      <svg className="w-full h-full" viewBox="0 0 400 100" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="conversionsGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#f97316" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        {(() => {
                          const maxVal = Math.max(...conversionsData);
                          const points = conversionsData.map((val, idx) => ({
                            x: (idx / (conversionsData.length - 1)) * 400,
                            y: 100 - (val / maxVal) * 80
                          }));
                          
                          // Tạo smooth curve với cubic bezier
                          const createSmoothPath = (points: {x: number, y: number}[]) => {
                            if (points.length < 2) return '';
                            let path = `M ${points[0].x},${points[0].y}`;
                            for (let i = 0; i < points.length - 1; i++) {
                              const p0 = points[Math.max(0, i - 1)];
                              const p1 = points[i];
                              const p2 = points[i + 1];
                              const p3 = points[Math.min(points.length - 1, i + 2)];
                              
                              const cp1x = p1.x + (p2.x - p0.x) / 6;
                              const cp1y = p1.y + (p2.y - p0.y) / 6;
                              const cp2x = p2.x - (p3.x - p1.x) / 6;
                              const cp2y = p2.y - (p3.y - p1.y) / 6;
                              
                              path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
                            }
                            return path;
                          };
                          
                          const smoothPath = createSmoothPath(points);
                          const fillPath = `${smoothPath} L 400,100 L 0,100 Z`;
                          return (
                            <>
                              <path d={fillPath} fill="url(#conversionsGradient)" />
                              <path
                                d={smoothPath}
                                fill="none"
                                stroke="#f97316"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                              />
                              {points.map((point, idx) => (
                                <g key={idx}>
                                  <circle cx={point.x} cy={point.y} r="2.5" fill="#f97316" />
                                  <text
                                    x={point.x}
                                    y={point.y - 6}
                                    textAnchor="middle"
                                    fill="#ffffff"
                                    fontSize="9"
                                    fontWeight="500"
                                  >
                                    {conversionsData[idx]}
                                  </text>
                                </g>
                              ))}
                            </>
                          );
                        })()}
                      </svg>
                      <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[8px] text-gray-400 px-1">
                        {chartDates.map((date, idx) => (
                          <span key={idx} className="text-center" style={{ width: `${100 / chartDates.length}%` }}>
                            {date}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Donut Chart */}
                  <div className="w-20 flex-shrink-0">
                    <div className="text-[10px] text-gray-400 mb-1">Distribution</div>
                    <div className="h-16 relative flex items-center justify-center">
                      <svg className="w-full h-full" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="35" fill="none" stroke="#1e293b" strokeWidth="8" />
                        <circle
                          cx="50"
                          cy="50"
                          r="35"
                          fill="none"
                          stroke="#f97316"
                          strokeWidth="8"
                          strokeDasharray={`${56 * 2 * Math.PI * 35 / 100} ${2 * Math.PI * 35}`}
                          strokeDashoffset="0"
                          transform="rotate(-90 50 50)"
                        />
                        <text x="50" y="48" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold">56%</text>
                        <text x="50" y="58" textAnchor="middle" fill="#9ca3af" fontSize="8">Share</text>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
                </div>

                {/* Daily Report Table */}
                <div className="bg-ads-card rounded-xl overflow-hidden mb-8">
                  <div className="p-4 border-b border-gray-700">
                    <h3 className="text-lg font-bold">Daily Report</h3>
                  </div>
                  <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="p-2 border border-gray-700 bg-ads-table-header font-bold text-left">TỔNG</th>
                      {dailyReportData.map((day, idx) => (
                        <th key={idx} className="p-2 border border-gray-700 bg-ads-table-header font-bold text-center min-w-[80px]">
                          <div>{day.date}</div>
                          <div className="text-xs text-gray-400">{day.day}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Marketing Report Section */}
                    <tr className="bg-gray-800/50">
                      <td colSpan={11} className="p-2 border border-gray-700 font-bold text-white">Marketing Report</td>
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-700 text-white font-medium">Marketing Expenses</td>
                      <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{formatCurrency(dailyReportTotals.marketingExpenses)}</td>
                      {dailyReportData.map((day, idx) => (
                        <td key={idx} className="p-2 border border-gray-700 text-right text-gray-300">{formatCurrency(day.marketingExpenses)}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-700 text-white font-medium">Impression</td>
                      <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{formatCurrency(dailyReportTotals.impression)}</td>
                      {dailyReportData.map((day, idx) => (
                        <td key={idx} className="p-2 border border-gray-700 text-right text-gray-300">{formatCurrency(day.impression)}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-700 text-white font-medium">CPM</td>
                      <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{formatCurrency(Math.round(avgCpm))}</td>
                      {dailyReportData.map((day, idx) => (
                        <td key={idx} className="p-2 border border-gray-700 text-right text-gray-300">{day.cpm > 0 ? formatCurrency(day.cpm) : '0'}</td>
                      ))}
                    </tr>
                    
                    {/* Comments Report Section */}
                    <tr className="bg-orange-900/30">
                      <td colSpan={11} className="p-2 border border-gray-700 font-bold text-white">Comments Report</td>
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-700 text-white font-medium">Total comments</td>
                      <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{formatCurrency(dailyReportTotals.comments)}</td>
                      {dailyReportData.map((day, idx) => (
                        <td key={idx} className="p-2 border border-gray-700 text-right text-gray-300">{formatCurrency(day.comments)}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-700 text-white font-medium">Comments/Impression, %</td>
                      <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold text-green-400">{avgCommentsPerImp.toFixed(2)}%</td>
                      {dailyReportData.map((day, idx) => (
                        <td key={idx} className={`p-2 border border-gray-700 text-right ${day.commentsPerImp > 0 ? 'text-green-400' : 'text-gray-300'}`}>
                          {day.commentsPerImp > 0 ? `${day.commentsPerImp.toFixed(2)}%` : '0%'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-700 text-white font-medium">Cost per comment</td>
                      <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{formatCurrency(Math.round(avgCostPerComment))}</td>
                      {dailyReportData.map((day, idx) => (
                        <td key={idx} className="p-2 border border-gray-700 text-right text-gray-300">{day.costPerComment > 0 ? formatCurrency(day.costPerComment) : '0'}</td>
                      ))}
                    </tr>
                    
                    {/* New Messages Report Section */}
                    <tr className="bg-gray-800/50">
                      <td colSpan={11} className="p-2 border border-gray-700 font-bold text-white">New Messages Report</td>
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-700 text-white font-medium">Total new messages</td>
                      <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{formatCurrency(dailyReportTotals.newMessages)}</td>
                      {dailyReportData.map((day, idx) => (
                        <td key={idx} className="p-2 border border-gray-700 text-right text-gray-300">{formatCurrency(day.newMessages)}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-700 text-white font-medium">New messages/Impression, %</td>
                      <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold text-green-400">{avgNewMessagesPerImp.toFixed(2)}%</td>
                      {dailyReportData.map((day, idx) => (
                        <td key={idx} className={`p-2 border border-gray-700 text-right ${day.newMessagesPerImp > 0 ? 'text-green-400' : 'text-gray-300'}`}>
                          {day.newMessagesPerImp > 0 ? `${day.newMessagesPerImp.toFixed(2)}%` : '0%'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-700 text-white font-medium">Cost per new message</td>
                      <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{formatCurrency(Math.round(avgCostPerNewMessage))}</td>
                      {dailyReportData.map((day, idx) => (
                        <td key={idx} className="p-2 border border-gray-700 text-right text-gray-300">{day.costPerNewMessage > 0 ? formatCurrency(day.costPerNewMessage) : '0'}</td>
                      ))}
                    </tr>
                    
                    {/* Sales Report Section */}
                    <tr className="bg-gray-800/50">
                      <td colSpan={11} className="p-2 border border-gray-700 font-bold text-white">Sales Report</td>
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-700 text-white font-medium">Total sales</td>
                      <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{formatCurrency(dailyReportTotals.sales)}</td>
                      {dailyReportData.map((day, idx) => (
                        <td key={idx} className="p-2 border border-gray-700 text-right text-gray-300">{formatCurrency(day.sales)}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-700 text-white font-medium">Sales/Impression, %</td>
                      <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{avgSalesPerImp.toFixed(4)}%</td>
                      {dailyReportData.map((day, idx) => {
                        const color = day.salesPerImp > 0.01 ? 'text-green-400' : day.salesPerImp === 0 ? 'text-red-400' : 'text-red-400';
                        return (
                          <td key={idx} className={`p-2 border border-gray-700 text-right ${color}`}>
                            {day.salesPerImp > 0 ? `${day.salesPerImp.toFixed(4)}%` : '0.0000%'}
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-700 text-white font-medium">Cost per sale</td>
                      <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{formatCurrency(Math.round(avgCostPerSale))}</td>
                      {dailyReportData.map((day, idx) => (
                        <td key={idx} className="p-2 border border-gray-700 text-right text-gray-300">{day.costPerSale > 0 ? formatCurrency(day.costPerSale) : '0'}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

                {/* Weekly Report Table */}
                <div className="bg-ads-card rounded-xl overflow-hidden mb-8">
                  <div className="p-4 border-b border-gray-700">
                <h3 className="text-lg font-bold">Weekly Report</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="p-2 border border-gray-700 bg-ads-table-header font-bold text-left">TỔNG</th>
                      {weeklyReportData.map((week, idx) => (
                        <th key={idx} className="p-2 border border-gray-700 bg-ads-table-header font-bold text-center min-w-[80px]">
                          <div className="text-xs">{week.endDate}</div>
                          <div className="text-xs text-gray-400 whitespace-pre-line">{week.week}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Marketing Report Section */}
                    <tr className="bg-gray-800/50">
                      <td colSpan={10} className="p-2 border border-gray-700 font-bold text-white">Marketing Report</td>
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-700 text-white font-medium">ME</td>
                      <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{formatCurrency(weeklyReportTotals.me)}</td>
                      {weeklyReportData.map((week, idx) => (
                        <td key={idx} className="p-2 border border-gray-700 text-right text-gray-300">{formatCurrency(week.me)}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-700 text-white font-medium">Impression</td>
                      <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{formatCurrency(weeklyReportTotals.impression)}</td>
                      {weeklyReportData.map((week, idx) => (
                        <td key={idx} className="p-2 border border-gray-700 text-right text-gray-300">{formatCurrency(week.impression)}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-700 text-white font-medium">CPM</td>
                      <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{formatCurrency(Math.round(weeklyAvgCpm))}</td>
                      {weeklyReportData.map((week, idx) => (
                        <td key={idx} className="p-2 border border-gray-700 text-right text-gray-300">{week.cpm > 0 ? formatCurrency(week.cpm) : '0'}</td>
                      ))}
                    </tr>
                    
                    {/* Comments Report Section */}
                    <tr className="bg-orange-900/30">
                      <td colSpan={10} className="p-2 border border-gray-700 font-bold text-white">Comments Report</td>
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-700 text-white font-medium">Total comments</td>
                      <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{formatCurrency(weeklyReportTotals.comments)}</td>
                      {weeklyReportData.map((week, idx) => (
                        <td key={idx} className="p-2 border border-gray-700 text-right text-gray-300">{formatCurrency(week.comments)}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-700 text-white font-medium">Comments/Impression, %</td>
                      <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold text-green-400">{weeklyAvgCommentsPerImp.toFixed(2).replace('.', ',')}%</td>
                      {weeklyReportData.map((week, idx) => (
                        <td key={idx} className={`p-2 border border-gray-700 text-right ${week.commentsPerImp > 0 ? 'text-green-400' : 'text-gray-300'}`}>
                          {week.commentsPerImp > 0 ? `${week.commentsPerImp.toFixed(2).replace('.', ',')}%` : '0%'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-700 text-white font-medium">Cost per comment</td>
                      <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{formatCurrency(Math.round(weeklyAvgCostPerComment))}</td>
                      {weeklyReportData.map((week, idx) => (
                        <td key={idx} className="p-2 border border-gray-700 text-right text-gray-300">{week.costPerComment > 0 ? formatCurrency(week.costPerComment) : ''}</td>
                      ))}
                    </tr>
                    
                    {/* New Messages Report Section */}
                    <tr className="bg-gray-800/50">
                      <td colSpan={10} className="p-2 border border-gray-700 font-bold text-white">New Messages Report</td>
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-700 text-white font-medium">Total new messages</td>
                      <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{formatCurrency(weeklyReportTotals.newMessages)}</td>
                      {weeklyReportData.map((week, idx) => (
                        <td key={idx} className="p-2 border border-gray-700 text-right text-gray-300">{formatCurrency(week.newMessages)}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-700 text-white font-medium">New messages/Impression, %</td>
                      <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold text-green-400">{weeklyAvgNewMessagesPerImp.toFixed(2).replace('.', ',')}%</td>
                      {weeklyReportData.map((week, idx) => (
                        <td key={idx} className={`p-2 border border-gray-700 text-right ${week.newMessagesPerImp > 0 ? 'text-green-400' : 'text-gray-300'}`}>
                          {week.newMessagesPerImp > 0 ? `${week.newMessagesPerImp.toFixed(2).replace('.', ',')}%` : '0%'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-700 text-white font-medium">Cost per new message</td>
                      <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{formatCurrency(Math.round(weeklyAvgCostPerNewMessage))}</td>
                      {weeklyReportData.map((week, idx) => (
                        <td key={idx} className="p-2 border border-gray-700 text-right text-gray-300">{week.costPerNewMessage > 0 ? formatCurrency(week.costPerNewMessage) : ''}</td>
                      ))}
                    </tr>
                    
                    {/* Sales Report Section */}
                    <tr className="bg-gray-800/50">
                      <td colSpan={10} className="p-2 border border-gray-700 font-bold text-white">Sales Report</td>
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-700 text-white font-medium">Total sales</td>
                      <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{formatCurrency(weeklyReportTotals.sales)}</td>
                      {weeklyReportData.map((week, idx) => (
                        <td key={idx} className="p-2 border border-gray-700 text-right text-gray-300">{formatCurrency(week.sales)}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-700 text-white font-medium">Sales/Impression, %</td>
                      <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{weeklyAvgSalesPerImp.toFixed(4).replace('.', ',')}%</td>
                      {weeklyReportData.map((week, idx) => {
                        const color = week.salesPerImp > 0.01 ? 'text-green-400' : week.salesPerImp === 0 ? 'text-red-400' : 'text-red-400';
                        return (
                          <td key={idx} className={`p-2 border border-gray-700 text-right ${color}`}>
                            {week.salesPerImp > 0 ? `${week.salesPerImp.toFixed(4).replace('.', ',')}%` : '0%'}
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-700 text-white font-medium">Cost persale</td>
                      <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{formatCurrency(Math.round(weeklyAvgCostPerSale))}</td>
                      {weeklyReportData.map((week, idx) => (
                        <td key={idx} className="p-2 border border-gray-700 text-right text-gray-300">{week.costPerSale > 0 ? formatCurrency(week.costPerSale) : ''}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
                </div>

                {/* Monthly Report Table */}
                <div className="bg-ads-card rounded-xl overflow-hidden mb-8">
                  <div className="p-4 border-b border-gray-700">
                <h3 className="text-lg font-bold">Monthly Report</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="p-2 border border-gray-700 bg-ads-table-header font-bold text-left">TỔNG</th>
                      {monthlyReportData.map((month, idx) => (
                        <th key={idx} className="p-2 border border-gray-700 bg-ads-table-header font-bold text-center min-w-[80px]">
                          <div className="text-xs">{month.endDate}</div>
                          <div className="text-xs text-gray-400">{month.month}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Marketing Report Section */}
                    <tr className="bg-gray-800/50">
                      <td colSpan={13} className="p-2 border border-gray-700 font-bold text-white">Marketing Report</td>
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-700 text-white font-medium">ME</td>
                      <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{formatCurrency(monthlyReportTotals.me)}</td>
                      {monthlyReportData.map((month, idx) => (
                        <td key={idx} className="p-2 border border-gray-700 text-right text-gray-300">{formatCurrency(month.me)}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-700 text-white font-medium">Impression</td>
                      <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{formatCurrency(monthlyReportTotals.impression)}</td>
                      {monthlyReportData.map((month, idx) => (
                        <td key={idx} className="p-2 border border-gray-700 text-right text-gray-300">{formatCurrency(month.impression)}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-700 text-white font-medium">CPM</td>
                      <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{formatCurrency(Math.round(monthlyAvgCpm))}</td>
                      {monthlyReportData.map((month, idx) => (
                        <td key={idx} className="p-2 border border-gray-700 text-right text-gray-300">{month.cpm > 0 ? formatCurrency(month.cpm) : '0'}</td>
                      ))}
                    </tr>
                    
                    {/* Comments Report Section */}
                    <tr className="bg-orange-900/30">
                      <td colSpan={13} className="p-2 border border-gray-700 font-bold text-white">Comments Report</td>
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-700 text-white font-medium">Total comments</td>
                      <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{formatCurrency(monthlyReportTotals.comments)}</td>
                      {monthlyReportData.map((month, idx) => (
                        <td key={idx} className="p-2 border border-gray-700 text-right text-gray-300">{formatCurrency(month.comments)}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-700 text-white font-medium">Comments/Impression, %</td>
                      <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold text-green-400">{monthlyAvgCommentsPerImp.toFixed(2).replace('.', ',')}%</td>
                      {monthlyReportData.map((month, idx) => (
                        <td key={idx} className={`p-2 border border-gray-700 text-right ${month.commentsPerImp > 0 ? 'text-green-400' : 'text-gray-300'}`}>
                          {month.commentsPerImp > 0 ? `${month.commentsPerImp.toFixed(2).replace('.', ',')}%` : '0%'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-700 text-white font-medium">Cost per comment</td>
                      <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{formatCurrency(Math.round(monthlyAvgCostPerComment))}</td>
                      {monthlyReportData.map((month, idx) => (
                        <td key={idx} className="p-2 border border-gray-700 text-right text-gray-300">{month.costPerComment > 0 ? formatCurrency(month.costPerComment) : ''}</td>
                      ))}
                    </tr>
                    
                    {/* New Messages Report Section */}
                    <tr className="bg-gray-800/50">
                      <td colSpan={13} className="p-2 border border-gray-700 font-bold text-white">New Messages Report</td>
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-700 text-white font-medium">Total new messages</td>
                      <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{formatCurrency(monthlyReportTotals.newMessages)}</td>
                      {monthlyReportData.map((month, idx) => (
                        <td key={idx} className="p-2 border border-gray-700 text-right text-gray-300">{formatCurrency(month.newMessages)}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-700 text-white font-medium">New messages/Impression, %</td>
                      <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold text-green-400">{monthlyAvgNewMessagesPerImp.toFixed(2).replace('.', ',')}%</td>
                      {monthlyReportData.map((month, idx) => (
                        <td key={idx} className={`p-2 border border-gray-700 text-right ${month.newMessagesPerImp > 0 ? 'text-green-400' : 'text-gray-300'}`}>
                          {month.newMessagesPerImp > 0 ? `${month.newMessagesPerImp.toFixed(2).replace('.', ',')}%` : '0%'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-700 text-white font-medium">Cost per new message</td>
                      <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{formatCurrency(Math.round(monthlyAvgCostPerNewMessage))}</td>
                      {monthlyReportData.map((month, idx) => (
                        <td key={idx} className="p-2 border border-gray-700 text-right text-gray-300">{month.costPerNewMessage > 0 ? formatCurrency(month.costPerNewMessage) : ''}</td>
                      ))}
                    </tr>
                    
                    {/* Sales Report Section */}
                    <tr className="bg-gray-800/50">
                      <td colSpan={13} className="p-2 border border-gray-700 font-bold text-white">Sales Report</td>
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-700 text-white font-medium">Total sales</td>
                      <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{formatCurrency(monthlyReportTotals.sales)}</td>
                      {monthlyReportData.map((month, idx) => (
                        <td key={idx} className="p-2 border border-gray-700 text-right text-gray-300">{formatCurrency(month.sales)}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-700 text-white font-medium">Sales/Impression, %</td>
                      <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{monthlyAvgSalesPerImp.toFixed(4).replace('.', ',')}%</td>
                      {monthlyReportData.map((month, idx) => {
                        const color = month.salesPerImp > 0.01 ? 'text-green-400' : month.salesPerImp === 0 ? 'text-red-400' : 'text-red-400';
                        return (
                          <td key={idx} className={`p-2 border border-gray-700 text-right ${color}`}>
                            {month.salesPerImp > 0 ? `${month.salesPerImp.toFixed(4).replace('.', ',')}%` : '0%'}
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-700 text-white font-medium">Cost persale</td>
                      <td className="p-2 border border-gray-700 text-right text-gray-300 font-bold">{formatCurrency(Math.round(monthlyAvgCostPerSale))}</td>
                      {monthlyReportData.map((month, idx) => (
                        <td key={idx} className="p-2 border border-gray-700 text-right text-gray-300">{month.costPerSale > 0 ? formatCurrency(month.costPerSale) : ''}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
                </div>

                {/* Dashboard */}
                <div className="bg-ads-card rounded-xl overflow-hidden mb-8">
                  <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                    <h3 className="text-lg font-bold">MARKETING DASHBOARD</h3>
                    <div className="text-sm text-gray-400">Lọc ngày: 08-01 - 31-01</div>
                  </div>
                  <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column - Summary Tables */}
                    <div className="space-y-6">
                  {/* Marketing Expenses */}
                  <div className="bg-[#0f1134] rounded-lg p-4">
                    <h4 className="text-sm font-bold text-white mb-3">Marketing Expenses</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-gray-300">
                        <span>Marketing Expenses:</span>
                        <span className="font-bold text-white">1.529.174.674</span>
                      </div>
                      <div className="flex justify-between text-gray-300">
                        <span>Impression:</span>
                        <span className="font-bold text-white">8.659.563</span>
                      </div>
                      <div className="flex justify-between text-gray-300">
                        <span>CPM:</span>
                        <span className="font-bold text-white">176.588</span>
                      </div>
                    </div>
                  </div>

                  {/* Comments Report */}
                  <div className="bg-[#0f1134] rounded-lg p-4">
                    <h4 className="text-sm font-bold text-white mb-3">Comments Report</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-gray-300">
                        <span>Total comments:</span>
                        <span className="font-bold text-white">4.434</span>
                      </div>
                      <div className="flex justify-between text-gray-300">
                        <span>Comments/Impression, %:</span>
                        <span className="font-bold text-green-400">0,05%</span>
                      </div>
                      <div className="flex justify-between text-gray-300">
                        <span>Cost per comment:</span>
                        <span className="font-bold text-white">344.875</span>
                      </div>
                    </div>
                  </div>

                  {/* New Messages Report */}
                  <div className="bg-[#0f1134] rounded-lg p-4">
                    <h4 className="text-sm font-bold text-white mb-3">New Messages Report</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-gray-300">
                        <span>Total New Messages:</span>
                        <span className="font-bold text-white">9.311</span>
                      </div>
                      <div className="flex justify-between text-gray-300">
                        <span>New Messages/Impression:</span>
                        <span className="font-bold text-green-400">0,11%</span>
                      </div>
                      <div className="flex justify-between text-gray-300">
                        <span>Cost per new messages:</span>
                        <span className="font-bold text-white">164.233</span>
                      </div>
                    </div>
                  </div>

                  {/* Sales Report */}
                  <div className="bg-[#0f1134] rounded-lg p-4">
                    <h4 className="text-sm font-bold text-white mb-3">Sales Report</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-gray-300">
                        <span>Total sales:</span>
                        <span className="font-bold text-white">607</span>
                      </div>
                      <div className="flex justify-between text-gray-300">
                        <span>Sales/Impression, %:</span>
                        <span className="font-bold text-green-400">0,01%</span>
                      </div>
                      <div className="flex justify-between text-gray-300">
                        <span>Cost per Sales:</span>
                        <span className="font-bold text-white">2.519.233</span>
                      </div>
                    </div>
                  </div>

                  {/* Accounts Report */}
                  <div className="bg-[#0f1134] rounded-lg p-4">
                    <h4 className="text-sm font-bold text-white mb-3">Accounts report (Tài khoản - Chi tiêu)</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-gray-300">
                        <span>TIEUNI 001:</span>
                        <span className="font-bold text-white">73.904.216 d</span>
                      </div>
                      <div className="flex justify-between text-gray-300">
                        <span>PHA 10 - VIP99:</span>
                        <span className="font-bold text-white">92.806.832 d</span>
                      </div>
                      <div className="flex justify-between text-gray-300">
                        <span>NHATMINH 001:</span>
                        <span className="font-bold text-white">783.137.061 d</span>
                      </div>
                      <div className="flex justify-between text-gray-300">
                        <span>PHA 14:</span>
                        <span className="font-bold text-white">386.488.835 d</span>
                      </div>
                      <div className="flex justify-between text-gray-300">
                        <span>PHA 33:</span>
                        <span className="font-bold text-white">192.837.730 d</span>
                      </div>
                    </div>
                  </div>
                    </div>

                    {/* Right Column - Charts */}
                    <div className="space-y-6">
                  {/* Chart 1: Spending and Impressions by Day */}
                  <div className="bg-[#0f1134] rounded-lg p-4">
                    <h4 className="text-sm font-bold text-white mb-3">Số tiền chi tiêu và lượt hiển thị theo ngày</h4>
                    <div className="h-48 relative">
                      <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
                        {/* Y-axis labels for Spending (left) */}
                        <text x="10" y="20" fill="#9ca3af" fontSize="10">600M</text>
                        <text x="10" y="100" fill="#9ca3af" fontSize="10">300M</text>
                        <text x="10" y="180" fill="#9ca3af" fontSize="10">0</text>
                        {/* Y-axis labels for Impressions (right) */}
                        <text x="380" y="20" fill="#9ca3af" fontSize="10">3M</text>
                        <text x="380" y="100" fill="#9ca3af" fontSize="10">1.5M</text>
                        <text x="380" y="180" fill="#9ca3af" fontSize="10">0</text>
                        {/* Bars for Spending */}
                        <rect x="60" y="100" width="60" height="100" fill="#f97316" opacity="0.7" />
                        <rect x="140" y="30" width="60" height="170" fill="#f97316" opacity="0.7" />
                        <rect x="220" y="100" width="60" height="100" fill="#f97316" opacity="0.7" />
                        <rect x="300" y="140" width="60" height="60" fill="#f97316" opacity="0.7" />
                        {/* Line for Impressions */}
                        <polyline
                          points="90,80 170,50 250,50 330,100"
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="2"
                        />
                        {/* X-axis labels */}
                        <text x="90" y="195" fill="#9ca3af" fontSize="9" textAnchor="middle">08</text>
                        <text x="170" y="195" fill="#9ca3af" fontSize="9" textAnchor="middle">09</text>
                        <text x="250" y="195" fill="#9ca3af" fontSize="9" textAnchor="middle">10</text>
                        <text x="330" y="195" fill="#9ca3af" fontSize="9" textAnchor="middle">11</text>
                      </svg>
                    </div>
                  </div>

                  {/* Chart 2: Spending by Account (Donut) */}
                  <div className="bg-[#0f1134] rounded-lg p-4">
                    <h4 className="text-sm font-bold text-white mb-3">Chi tiêu theo tài khoản</h4>
                    <div className="h-48 flex items-center justify-center">
                      <svg className="w-full h-full" viewBox="0 0 200 200">
                        <circle cx="100" cy="100" r="60" fill="none" stroke="#1e293b" strokeWidth="30" />
                        <circle cx="100" cy="100" r="60" fill="none" stroke="#10b981" strokeWidth="30" strokeDasharray={`${51.2 * 3.77} ${377 - 51.2 * 3.77}`} strokeDashoffset="0" transform="rotate(-90 100 100)" />
                        <circle cx="100" cy="100" r="60" fill="none" stroke="#f97316" strokeWidth="30" strokeDasharray={`${25.3 * 3.77} ${377 - 25.3 * 3.77}`} strokeDashoffset={`${-51.2 * 3.77}`} transform="rotate(-90 100 100)" />
                        <circle cx="100" cy="100" r="60" fill="none" stroke="#3b82f6" strokeWidth="30" strokeDasharray={`${12.6 * 3.77} ${377 - 12.6 * 3.77}`} strokeDashoffset={`${-(51.2 + 25.3) * 3.77}`} transform="rotate(-90 100 100)" />
                        <text x="100" y="95" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="bold">51.2%</text>
                        <text x="100" y="110" textAnchor="middle" fill="#9ca3af" fontSize="10">NHATMINH</text>
                      </svg>
                    </div>
                  </div>

                  {/* Chart 3: Messages, Comments, and Impressions by Day */}
                  <div className="bg-[#0f1134] rounded-lg p-4">
                    <h4 className="text-sm font-bold text-white mb-3">Lượt nhắn tin, bình luận và lượt hiển thị theo ngày</h4>
                    <div className="h-48 relative">
                      <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
                        {/* Y-axis labels */}
                        <text x="10" y="20" fill="#9ca3af" fontSize="10">4K</text>
                        <text x="10" y="100" fill="#9ca3af" fontSize="10">2K</text>
                        <text x="10" y="180" fill="#9ca3af" fontSize="10">0</text>
                        <text x="380" y="20" fill="#9ca3af" fontSize="10">3M</text>
                        <text x="380" y="100" fill="#9ca3af" fontSize="10">1.5M</text>
                        <text x="380" y="180" fill="#9ca3af" fontSize="10">0</text>
                        {/* Bars for Comments */}
                        <rect x="60" y="120" width="40" height="60" fill="#f97316" opacity="0.7" />
                        <rect x="140" y="110" width="40" height="70" fill="#f97316" opacity="0.7" />
                        <rect x="220" y="130" width="40" height="50" fill="#f97316" opacity="0.7" />
                        <rect x="300" y="120" width="40" height="60" fill="#f97316" opacity="0.7" />
                        {/* Line for Impressions */}
                        <polyline
                          points="90,50 170,50 250,50 330,100"
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="2"
                        />
                        {/* Line for New Messages */}
                        <polyline
                          points="90,180 170,180 250,50 330,80"
                          fill="none"
                          stroke="#eab308"
                          strokeWidth="2"
                        />
                        {/* X-axis labels */}
                        <text x="90" y="195" fill="#9ca3af" fontSize="9" textAnchor="middle">08</text>
                        <text x="170" y="195" fill="#9ca3af" fontSize="9" textAnchor="middle">09</text>
                        <text x="250" y="195" fill="#9ca3af" fontSize="9" textAnchor="middle">10</text>
                        <text x="330" y="195" fill="#9ca3af" fontSize="9" textAnchor="middle">11</text>
                      </svg>
                    </div>
                  </div>

                  {/* Chart 4: Impressions and Sales by Time Slot */}
                  <div className="bg-[#0f1134] rounded-lg p-4">
                    <h4 className="text-sm font-bold text-white mb-3">Lượt hiển thị và lượt bán hàng theo khung thời gian</h4>
                    <div className="h-48 relative">
                      <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
                        {/* Y-axis labels */}
                        <text x="10" y="20" fill="#9ca3af" fontSize="10">10M</text>
                        <text x="10" y="100" fill="#9ca3af" fontSize="10">5M</text>
                        <text x="10" y="180" fill="#9ca3af" fontSize="10">0</text>
                        <text x="380" y="20" fill="#9ca3af" fontSize="10">600</text>
                        <text x="380" y="100" fill="#9ca3af" fontSize="10">300</text>
                        <text x="380" y="180" fill="#9ca3af" fontSize="10">0</text>
                        {/* Bars for Impressions */}
                        <rect x="40" y="195" width="50" height="5" fill="#f97316" opacity="0.7" />
                        <rect x="110" y="20" width="50" height="180" fill="#f97316" opacity="0.7" />
                        <rect x="180" y="5" width="50" height="195" fill="#f97316" opacity="0.7" />
                        <rect x="250" y="0" width="50" height="200" fill="#f97316" opacity="0.7" />
                        <rect x="320" y="0" width="50" height="200" fill="#f97316" opacity="0.7" />
                        {/* Line for Sales */}
                        <polyline
                          points="65,195 135,195 205,195 275,30 345,0"
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="2"
                        />
                        {/* X-axis labels */}
                        <text x="65" y="215" fill="#9ca3af" fontSize="9" textAnchor="middle">08:00</text>
                        <text x="135" y="215" fill="#9ca3af" fontSize="9" textAnchor="middle">12:00</text>
                        <text x="205" y="215" fill="#9ca3af" fontSize="9" textAnchor="middle">17:00</text>
                        <text x="275" y="215" fill="#9ca3af" fontSize="9" textAnchor="middle">21:00</text>
                        <text x="345" y="215" fill="#9ca3af" fontSize="9" textAnchor="middle">23:30</text>
                      </svg>
                    </div>
                  </div>

                  {/* Chart 5: Sales and Impressions by Day */}
                  <div className="bg-[#0f1134] rounded-lg p-4">
                    <h4 className="text-sm font-bold text-white mb-3">Lượt bán hàng và lượt hiển thị theo ngày</h4>
                    <div className="h-48 relative">
                      <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
                        {/* Y-axis labels */}
                        <text x="10" y="20" fill="#9ca3af" fontSize="10">300</text>
                        <text x="10" y="100" fill="#9ca3af" fontSize="10">150</text>
                        <text x="10" y="180" fill="#9ca3af" fontSize="10">0</text>
                        <text x="380" y="20" fill="#9ca3af" fontSize="10">3M</text>
                        <text x="380" y="100" fill="#9ca3af" fontSize="10">1.5M</text>
                        <text x="380" y="180" fill="#9ca3af" fontSize="10">0</text>
                        {/* Bars for Sales */}
                        <rect x="60" y="140" width="60" height="40" fill="#f97316" opacity="0.7" />
                        <rect x="140" y="200" width="60" height="0" fill="#f97316" opacity="0.7" />
                        <rect x="220" y="0" width="60" height="200" fill="#f97316" opacity="0.7" />
                        <rect x="300" y="60" width="60" height="140" fill="#f97316" opacity="0.7" />
                        {/* Line for Impressions */}
                        <polyline
                          points="90,50 170,50 250,50 330,100"
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="2"
                        />
                        {/* X-axis labels */}
                        <text x="90" y="215" fill="#9ca3af" fontSize="9" textAnchor="middle">08</text>
                        <text x="170" y="215" fill="#9ca3af" fontSize="9" textAnchor="middle">09</text>
                        <text x="250" y="215" fill="#9ca3af" fontSize="9" textAnchor="middle">10</text>
                        <text x="330" y="215" fill="#9ca3af" fontSize="9" textAnchor="middle">11</text>
                      </svg>
                    </div>
                  </div>

                  {/* Chart 6: Comments and Messages by Time Slot */}
                  <div className="bg-[#0f1134] rounded-lg p-4">
                    <h4 className="text-sm font-bold text-white mb-3">Lượt bình luận và tin nhắn theo khung thời gian</h4>
                    <div className="h-48 relative">
                      <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
                        {/* Y-axis labels */}
                        <text x="10" y="20" fill="#9ca3af" fontSize="10">8K</text>
                        <text x="10" y="100" fill="#9ca3af" fontSize="10">4K</text>
                        <text x="10" y="180" fill="#9ca3af" fontSize="10">0</text>
                        <text x="380" y="20" fill="#9ca3af" fontSize="10">2K</text>
                        <text x="380" y="100" fill="#9ca3af" fontSize="10">1K</text>
                        <text x="380" y="180" fill="#9ca3af" fontSize="10">0</text>
                        {/* Bars for Comments */}
                        <rect x="40" y="120" width="50" height="60" fill="#f97316" opacity="0.7" />
                        <rect x="110" y="100" width="50" height="80" fill="#f97316" opacity="0.7" />
                        <rect x="180" y="20" width="50" height="160" fill="#f97316" opacity="0.7" />
                        <rect x="250" y="0" width="50" height="200" fill="#f97316" opacity="0.7" />
                        <rect x="320" y="0" width="50" height="200" fill="#f97316" opacity="0.7" />
                        {/* Line for Messages */}
                        <polyline
                          points="65,180 135,175 205,100 275,60 345,40"
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="2"
                        />
                        {/* X-axis labels */}
                        <text x="65" y="215" fill="#9ca3af" fontSize="9" textAnchor="middle">08:00</text>
                        <text x="135" y="215" fill="#9ca3af" fontSize="9" textAnchor="middle">12:00</text>
                        <text x="205" y="215" fill="#9ca3af" fontSize="9" textAnchor="middle">17:00</text>
                        <text x="275" y="215" fill="#9ca3af" fontSize="9" textAnchor="middle">21:00</text>
                        <text x="345" y="215" fill="#9ca3af" fontSize="9" textAnchor="middle">23:30</text>
                      </svg>
                    </div>
                  </div>
                    </div>
                  </div>
                </div>
              </div>

                {/* Metrics Summary Table - Horizontal with Employee Data */}
                <div className="bg-ads-card rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-gray-700">
                    <h3 className="text-lg font-bold">Metrics Summary</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr>
                          <th className="p-3 border-r border-gray-700 bg-green-600 text-white font-bold text-left">Employee</th>
                          <th className="p-3 border-r border-gray-700 bg-green-600 text-white font-bold text-right">Revenue</th>
                          <th className="p-3 border-r border-gray-700 bg-green-600 text-white font-bold text-right">Cost</th>
                          <th className="p-3 border-r border-gray-700 bg-green-600 text-white font-bold text-right">Orders</th>
                          <th className="p-3 border-r border-gray-700 bg-green-600 text-white font-bold text-right">Leads</th>
                          <th className="p-3 border-r border-gray-700 bg-green-600 text-white font-bold text-right">Messages</th>
                          <th className="p-3 border-r border-gray-700 bg-yellow-400 text-gray-900 font-bold text-right">Ad Cost %</th>
                          <th className="p-3 border-r border-gray-700 bg-yellow-400 text-gray-900 font-bold text-right">Closing Rate %</th>
                          <th className="p-3 border-r border-gray-700 bg-yellow-400 text-gray-900 font-bold text-right">Contact Rate %</th>
                          <th className="p-3 border-r border-gray-700 bg-white text-gray-900 font-bold text-right">Avg Order Value</th>
                          <th className="p-3 border-r border-gray-700 bg-white text-gray-900 font-bold text-right">Cost per Order</th>
                          <th className="p-3 border-r border-gray-700 bg-white text-gray-900 font-bold text-right">Cost per Lead</th>
                          <th className="p-3 bg-white text-gray-900 font-bold text-right">Cost per Message</th>
                        </tr>
                      </thead>
                  <tbody>
                    {(() => {
                      // Mock employee data
                      const employeeMetrics = [
                        { name: 'Nguyen Van A', revenue: 4250000, cost: 1123443, orders: 1, leads: 4, messages: 17, adCostPercent: 26.43, closingRate: 25.00, contactRate: 23.53, avgOrderValue: 4250000, costPerOrder: 1123443, costPerLead: 280861, costPerMessage: 66085 },
                        { name: 'Tran Thi B', revenue: 3800000, cost: 980000, orders: 2, leads: 5, messages: 20, adCostPercent: 25.79, closingRate: 10.00, contactRate: 25.00, avgOrderValue: 1900000, costPerOrder: 490000, costPerLead: 196000, costPerMessage: 49000 },
                        { name: 'Le Van C', revenue: 5200000, cost: 1350000, orders: 3, leads: 6, messages: 24, adCostPercent: 25.96, closingRate: 12.50, contactRate: 25.00, avgOrderValue: 1733333, costPerOrder: 450000, costPerLead: 225000, costPerMessage: 56250 },
                        { name: 'Pham Thi D', revenue: 4500000, cost: 1150000, orders: 2, leads: 5, messages: 19, adCostPercent: 25.56, closingRate: 10.53, contactRate: 26.32, avgOrderValue: 2250000, costPerOrder: 575000, costPerLead: 230000, costPerMessage: 60526 },
                        { name: 'Hoang Van E', revenue: 4800000, cost: 1250000, orders: 3, leads: 7, messages: 22, adCostPercent: 26.04, closingRate: 13.64, contactRate: 31.82, avgOrderValue: 1600000, costPerOrder: 416667, costPerLead: 178571, costPerMessage: 56818 },
                      ];

                      return employeeMetrics.map((emp, idx) => (
                        <tr key={idx} className="border-b border-gray-700 hover:bg-ads-active/30">
                          <td className="p-3 border-r border-gray-700 text-white font-medium">{emp.name}</td>
                          <td className="p-3 border-r border-gray-700 text-right text-gray-300">{formatCurrency(emp.revenue)}</td>
                          <td className="p-3 border-r border-gray-700 text-right text-gray-300">{formatCurrency(emp.cost)}</td>
                          <td className="p-3 border-r border-gray-700 text-right text-gray-300">{formatCurrency(emp.orders)}</td>
                          <td className="p-3 border-r border-gray-700 text-right text-gray-300">{formatCurrency(emp.leads)}</td>
                          <td className="p-3 border-r border-gray-700 text-right text-gray-300">{formatCurrency(emp.messages)}</td>
                          <td className="p-3 border-r border-gray-700 text-right font-bold bg-yellow-400/20 text-yellow-400">{emp.adCostPercent.toFixed(2).replace('.', ',')}%</td>
                          <td className="p-3 border-r border-gray-700 text-right font-bold bg-yellow-400/20 text-yellow-400">{emp.closingRate.toFixed(2).replace('.', ',')}%</td>
                          <td className="p-3 border-r border-gray-700 text-right font-bold bg-yellow-400/20 text-yellow-400">{emp.contactRate.toFixed(2).replace('.', ',')}%</td>
                          <td className="p-3 border-r border-gray-700 text-right text-gray-300">{formatCurrency(emp.avgOrderValue)}</td>
                          <td className="p-3 border-r border-gray-700 text-right text-gray-300">{formatCurrency(emp.costPerOrder)}</td>
                          <td className="p-3 border-r border-gray-700 text-right text-gray-300">{formatCurrency(emp.costPerLead)}</td>
                          <td className="p-3 text-right text-gray-300">{formatCurrency(emp.costPerMessage)}</td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                  <tfoot className="bg-ads-table-header font-bold">
                    <tr>
                      <td className="p-3 border-r border-gray-700 text-right text-white">Total</td>
                      {(() => {
                        const employeeMetrics = [
                          { revenue: 4250000, cost: 1123443, orders: 1, leads: 4, messages: 17 },
                          { revenue: 3800000, cost: 980000, orders: 2, leads: 5, messages: 20 },
                          { revenue: 5200000, cost: 1350000, orders: 3, leads: 6, messages: 24 },
                          { revenue: 4500000, cost: 1150000, orders: 2, leads: 5, messages: 19 },
                          { revenue: 4800000, cost: 1250000, orders: 3, leads: 7, messages: 22 },
                        ];
                        const totals = employeeMetrics.reduce((acc, emp) => ({
                          revenue: acc.revenue + emp.revenue,
                          cost: acc.cost + emp.cost,
                          orders: acc.orders + emp.orders,
                          leads: acc.leads + emp.leads,
                          messages: acc.messages + emp.messages,
                        }), { revenue: 0, cost: 0, orders: 0, leads: 0, messages: 0 });

                        const totalAdCostPercent = totals.revenue > 0 ? (totals.cost / totals.revenue) * 100 : 0;
                        const totalClosingRate = totals.messages > 0 ? (totals.orders / totals.messages) * 100 : 0;
                        const totalContactRate = totals.messages > 0 ? (totals.leads / totals.messages) * 100 : 0;
                        const totalAvgOrderValue = totals.orders > 0 ? totals.revenue / totals.orders : 0;
                        const totalCostPerOrder = totals.orders > 0 ? totals.cost / totals.orders : 0;
                        const totalCostPerLead = totals.leads > 0 ? totals.cost / totals.leads : 0;
                        const totalCostPerMessage = totals.messages > 0 ? totals.cost / totals.messages : 0;

                        return (
                          <>
                            <td className="p-3 border-r border-gray-700 text-right text-white">{formatCurrency(totals.revenue)}</td>
                            <td className="p-3 border-r border-gray-700 text-right text-white">{formatCurrency(totals.cost)}</td>
                            <td className="p-3 border-r border-gray-700 text-right text-white">{formatCurrency(totals.orders)}</td>
                            <td className="p-3 border-r border-gray-700 text-right text-white">{formatCurrency(totals.leads)}</td>
                            <td className="p-3 border-r border-gray-700 text-right text-white">{formatCurrency(totals.messages)}</td>
                            <td className="p-3 border-r border-gray-700 text-right text-white">{totalAdCostPercent.toFixed(2).replace('.', ',')}%</td>
                            <td className="p-3 border-r border-gray-700 text-right text-white">{totalClosingRate.toFixed(2).replace('.', ',')}%</td>
                            <td className="p-3 border-r border-gray-700 text-right text-white">{totalContactRate.toFixed(2).replace('.', ',')}%</td>
                            <td className="p-3 border-r border-gray-700 text-right text-white">{formatCurrency(totalAvgOrderValue)}</td>
                            <td className="p-3 border-r border-gray-700 text-right text-white">{formatCurrency(totalCostPerOrder)}</td>
                            <td className="p-3 border-r border-gray-700 text-right text-white">{formatCurrency(totalCostPerLead)}</td>
                            <td className="p-3 text-right text-white">{formatCurrency(totalCostPerMessage)}</td>
                          </>
                        );
                      })()}
                    </tr>
                  </tfoot>
                  </table>
                  </div>
                </div>
              </>
            ) : activeTab === 'map' ? (
              <div className="w-full h-full min-h-[600px]">
                <iframe
                  src="https://nguyenbatyads37.github.io/static-html-show-data/Mapasia.html"
                  className="w-full h-full border-0 rounded-lg"
                  title="Bản đồ Đông Nam Á"
                  allowFullScreen
                />
              </div>
            ) : (
              /* Metrics Summary View */
              <div className="space-y-6">
                {/* Metrics Summary Table - Horizontal with Employee Data */}
                <div className="bg-ads-card rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-gray-700">
                    <h3 className="text-lg font-bold">Metrics Summary</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr>
                          <th className="p-3 border-r border-gray-700 bg-green-600 text-white font-bold text-left">Employee</th>
                          <th className="p-3 border-r border-gray-700 bg-green-600 text-white font-bold text-right">Revenue</th>
                          <th className="p-3 border-r border-gray-700 bg-green-600 text-white font-bold text-right">Cost</th>
                          <th className="p-3 border-r border-gray-700 bg-green-600 text-white font-bold text-right">Orders</th>
                          <th className="p-3 border-r border-gray-700 bg-green-600 text-white font-bold text-right">Leads</th>
                          <th className="p-3 border-r border-gray-700 bg-green-600 text-white font-bold text-right">Messages</th>
                          <th className="p-3 border-r border-gray-700 bg-yellow-400 text-gray-900 font-bold text-right">Ad Cost %</th>
                          <th className="p-3 border-r border-gray-700 bg-yellow-400 text-gray-900 font-bold text-right">Closing Rate %</th>
                          <th className="p-3 border-r border-gray-700 bg-yellow-400 text-gray-900 font-bold text-right">Contact Rate %</th>
                          <th className="p-3 border-r border-gray-700 bg-white text-gray-900 font-bold text-right">Avg Order Value</th>
                          <th className="p-3 border-r border-gray-700 bg-white text-gray-900 font-bold text-right">Cost per Order</th>
                          <th className="p-3 border-r border-gray-700 bg-white text-gray-900 font-bold text-right">Cost per Lead</th>
                          <th className="p-3 bg-white text-gray-900 font-bold text-right">Cost per Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          // Mock employee data
                          const employeeMetrics = [
                            { name: 'Nguyen Van A', revenue: 4250000, cost: 1123443, orders: 1, leads: 4, messages: 17, adCostPercent: 26.43, closingRate: 25.00, contactRate: 23.53, avgOrderValue: 4250000, costPerOrder: 1123443, costPerLead: 280861, costPerMessage: 66085 },
                            { name: 'Tran Thi B', revenue: 3800000, cost: 980000, orders: 2, leads: 5, messages: 20, adCostPercent: 25.79, closingRate: 10.00, contactRate: 25.00, avgOrderValue: 1900000, costPerOrder: 490000, costPerLead: 196000, costPerMessage: 49000 },
                            { name: 'Le Van C', revenue: 5200000, cost: 1350000, orders: 3, leads: 6, messages: 24, adCostPercent: 25.96, closingRate: 12.50, contactRate: 25.00, avgOrderValue: 1733333, costPerOrder: 450000, costPerLead: 225000, costPerMessage: 56250 },
                            { name: 'Pham Thi D', revenue: 4500000, cost: 1150000, orders: 2, leads: 5, messages: 19, adCostPercent: 25.56, closingRate: 10.53, contactRate: 26.32, avgOrderValue: 2250000, costPerOrder: 575000, costPerLead: 230000, costPerMessage: 60526 },
                            { name: 'Hoang Van E', revenue: 4800000, cost: 1250000, orders: 3, leads: 7, messages: 22, adCostPercent: 26.04, closingRate: 13.64, contactRate: 31.82, avgOrderValue: 1600000, costPerOrder: 416667, costPerLead: 178571, costPerMessage: 56818 },
                          ];

                          return employeeMetrics.map((emp, idx) => (
                            <tr key={idx} className="border-b border-gray-700 hover:bg-ads-active/30">
                              <td className="p-3 border-r border-gray-700 text-white font-medium">{emp.name}</td>
                              <td className="p-3 border-r border-gray-700 text-right text-gray-300">{formatCurrency(emp.revenue)}</td>
                              <td className="p-3 border-r border-gray-700 text-right text-gray-300">{formatCurrency(emp.cost)}</td>
                              <td className="p-3 border-r border-gray-700 text-right text-gray-300">{formatCurrency(emp.orders)}</td>
                              <td className="p-3 border-r border-gray-700 text-right text-gray-300">{formatCurrency(emp.leads)}</td>
                              <td className="p-3 border-r border-gray-700 text-right text-gray-300">{formatCurrency(emp.messages)}</td>
                              <td className="p-3 border-r border-gray-700 text-right font-bold bg-yellow-400/20 text-yellow-400">{emp.adCostPercent.toFixed(2).replace('.', ',')}%</td>
                              <td className="p-3 border-r border-gray-700 text-right font-bold bg-yellow-400/20 text-yellow-400">{emp.closingRate.toFixed(2).replace('.', ',')}%</td>
                              <td className="p-3 border-r border-gray-700 text-right font-bold bg-yellow-400/20 text-yellow-400">{emp.contactRate.toFixed(2).replace('.', ',')}%</td>
                              <td className="p-3 border-r border-gray-700 text-right text-gray-300">{formatCurrency(emp.avgOrderValue)}</td>
                              <td className="p-3 border-r border-gray-700 text-right text-gray-300">{formatCurrency(emp.costPerOrder)}</td>
                              <td className="p-3 border-r border-gray-700 text-right text-gray-300">{formatCurrency(emp.costPerLead)}</td>
                              <td className="p-3 text-right text-gray-300">{formatCurrency(emp.costPerMessage)}</td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                      <tfoot className="bg-ads-table-header font-bold">
                        <tr>
                          <td className="p-3 border-r border-gray-700 text-right text-white">Total</td>
                          {(() => {
                            const employeeMetrics = [
                              { revenue: 4250000, cost: 1123443, orders: 1, leads: 4, messages: 17 },
                              { revenue: 3800000, cost: 980000, orders: 2, leads: 5, messages: 20 },
                              { revenue: 5200000, cost: 1350000, orders: 3, leads: 6, messages: 24 },
                              { revenue: 4500000, cost: 1150000, orders: 2, leads: 5, messages: 19 },
                              { revenue: 4800000, cost: 1250000, orders: 3, leads: 7, messages: 22 },
                            ];
                            const totals = employeeMetrics.reduce((acc, emp) => ({
                              revenue: acc.revenue + emp.revenue,
                              cost: acc.cost + emp.cost,
                              orders: acc.orders + emp.orders,
                              leads: acc.leads + emp.leads,
                              messages: acc.messages + emp.messages,
                            }), { revenue: 0, cost: 0, orders: 0, leads: 0, messages: 0 });

                            const totalAdCostPercent = totals.revenue > 0 ? (totals.cost / totals.revenue) * 100 : 0;
                            const totalClosingRate = totals.messages > 0 ? (totals.orders / totals.messages) * 100 : 0;
                            const totalContactRate = totals.messages > 0 ? (totals.leads / totals.messages) * 100 : 0;
                            const totalAvgOrderValue = totals.orders > 0 ? totals.revenue / totals.orders : 0;
                            const totalCostPerOrder = totals.orders > 0 ? totals.cost / totals.orders : 0;
                            const totalCostPerLead = totals.leads > 0 ? totals.cost / totals.leads : 0;
                            const totalCostPerMessage = totals.messages > 0 ? totals.cost / totals.messages : 0;

                            return (
                              <>
                                <td className="p-3 border-r border-gray-700 text-right text-white">{formatCurrency(totals.revenue)}</td>
                                <td className="p-3 border-r border-gray-700 text-right text-white">{formatCurrency(totals.cost)}</td>
                                <td className="p-3 border-r border-gray-700 text-right text-white">{formatCurrency(totals.orders)}</td>
                                <td className="p-3 border-r border-gray-700 text-right text-white">{formatCurrency(totals.leads)}</td>
                                <td className="p-3 border-r border-gray-700 text-right text-white">{formatCurrency(totals.messages)}</td>
                                <td className="p-3 border-r border-gray-700 text-right text-white">{totalAdCostPercent.toFixed(2).replace('.', ',')}%</td>
                                <td className="p-3 border-r border-gray-700 text-right text-white">{totalClosingRate.toFixed(2).replace('.', ',')}%</td>
                                <td className="p-3 border-r border-gray-700 text-right text-white">{totalContactRate.toFixed(2).replace('.', ',')}%</td>
                                <td className="p-3 border-r border-gray-700 text-right text-white">{formatCurrency(totalAvgOrderValue)}</td>
                                <td className="p-3 border-r border-gray-700 text-right text-white">{formatCurrency(totalCostPerOrder)}</td>
                                <td className="p-3 border-r border-gray-700 text-right text-white">{formatCurrency(totalCostPerLead)}</td>
                                <td className="p-3 text-right text-white">{formatCurrency(totalCostPerMessage)}</td>
                              </>
                            );
                          })()}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
      <footer className="h-1 bg-ads-accent w-full"></footer>
      
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

// Southeast Asia Map Component
interface SoutheastAsiaMapProps {
  selectedCountry: string | null;
  onCountrySelect: (country: string | null) => void;
}

function SoutheastAsiaMap({ selectedCountry, onCountrySelect }: SoutheastAsiaMapProps) {
  const countries = [
    { 
      id: 'vietnam', 
      name: 'Việt Nam', 
      path: 'M 180 80 L 200 75 L 220 80 L 235 90 L 240 110 L 235 130 L 220 140 L 200 135 L 185 125 L 175 110 L 175 95 Z',
      x: 207, 
      y: 107 
    },
    { 
      id: 'thailand', 
      name: 'Thái Lan', 
      path: 'M 140 60 L 170 55 L 190 65 L 195 85 L 185 100 L 170 105 L 150 100 L 135 85 L 135 70 Z',
      x: 165, 
      y: 80 
    },
    { 
      id: 'malaysia', 
      name: 'Malaysia', 
      path: 'M 195 130 L 215 125 L 230 135 L 225 150 L 210 155 L 195 145 Z M 200 160 L 220 155 L 235 165 L 230 180 L 215 185 L 200 175 Z',
      x: 212, 
      y: 150 
    },
    { 
      id: 'singapore', 
      name: 'Singapore', 
      path: 'M 210 150 L 215 150 L 215 155 L 210 155 Z',
      x: 212, 
      y: 152 
    },
    { 
      id: 'indonesia', 
      name: 'Indonesia', 
      path: 'M 240 140 L 280 135 L 300 150 L 295 180 L 275 190 L 250 185 L 235 170 Z M 250 200 L 270 195 L 285 210 L 280 230 L 265 235 L 250 220 Z',
      x: 267, 
      y: 185 
    },
    { 
      id: 'philippines', 
      name: 'Philippines', 
      path: 'M 310 70 L 340 65 L 355 80 L 350 110 L 335 120 L 315 115 L 305 95 L 305 80 Z',
      x: 330, 
      y: 90 
    },
    { 
      id: 'cambodia', 
      name: 'Campuchia', 
      path: 'M 185 95 L 200 90 L 210 100 L 205 115 L 190 120 L 180 110 Z',
      x: 195, 
      y: 105 
    },
    { 
      id: 'laos', 
      name: 'Lào', 
      path: 'M 160 70 L 180 65 L 190 80 L 185 100 L 170 105 L 155 95 L 155 80 Z',
      x: 172, 
      y: 85 
    },
    { 
      id: 'myanmar', 
      name: 'Myanmar', 
      path: 'M 80 50 L 130 45 L 145 60 L 140 85 L 125 95 L 100 90 L 85 75 L 80 60 Z',
      x: 112, 
      y: 70 
    },
    { 
      id: 'brunei', 
      name: 'Brunei', 
      path: 'M 220 145 L 225 145 L 225 150 L 220 150 Z',
      x: 222, 
      y: 147 
    },
    { 
      id: 'east-timor', 
      name: 'Đông Timor', 
      path: 'M 260 200 L 265 200 L 265 205 L 260 205 Z',
      x: 262, 
      y: 202 
    }
  ];

  return (
    <div className="bg-ads-card rounded-xl p-6">
      <h3 className="text-lg font-bold mb-4">Bản đồ Đông Nam Á</h3>
      <div className="relative bg-[#0f1134] rounded-lg p-4 overflow-auto">
        <svg
          viewBox="0 0 400 250"
          className="w-full h-auto"
          style={{ minHeight: '500px' }}
        >
          {/* Background */}
          <rect width="400" height="250" fill="#0f1134" />
          
          {/* Countries */}
          {countries.map((country) => {
            const isSelected = selectedCountry === country.id;
            return (
              <g key={country.id}>
                <path
                  d={country.path}
                  fill={isSelected ? '#ff4d8d' : '#2d327d'}
                  stroke={isSelected ? '#ff4d8d' : '#1a1c4e'}
                  strokeWidth={isSelected ? '2' : '1'}
                  className="cursor-pointer transition-all hover:fill-[#3d428d]"
                  onClick={() => onCountrySelect(isSelected ? null : country.id)}
                  style={{
                    filter: isSelected ? 'brightness(1.3) drop-shadow(0 0 8px rgba(255, 77, 141, 0.6))' : 'none',
                    transition: 'all 0.3s ease'
                  }}
                />
                {/* Country label */}
                <text
                  x={country.x}
                  y={country.y}
                  fill={isSelected ? '#ffffff' : '#9ca3af'}
                  fontSize="10"
                  fontWeight={isSelected ? 'bold' : 'normal'}
                  textAnchor="middle"
                  className="pointer-events-none"
                >
                  {country.name}
                </text>
              </g>
            );
          })}
        </svg>
        
        {/* Selected Country Info */}
        {selectedCountry && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 bg-ads-active rounded-lg border border-pink-500/30"
          >
            <h4 className="text-lg font-bold text-pink-400 mb-2">
              {countries.find(c => c.id === selectedCountry)?.name}
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-400">Impressions</div>
                <div className="text-white font-semibold">12,345</div>
              </div>
              <div>
                <div className="text-gray-400">Clicks</div>
                <div className="text-white font-semibold">456</div>
              </div>
              <div>
                <div className="text-gray-400">Conversions</div>
                <div className="text-white font-semibold">23</div>
              </div>
              <div>
                <div className="text-gray-400">Cost</div>
                <div className="text-white font-semibold">1.234.567 ₫</div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
