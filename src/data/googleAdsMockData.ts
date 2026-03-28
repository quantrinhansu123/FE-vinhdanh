import { AdsMetrics, SearchTerm } from '../types';

export const mockAdsMetrics: AdsMetrics[] = [
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

export const projectsMock = [
  { name: 'Project Alpha', color: 'indigo' },
  { name: 'Project Beta', color: 'purple' },
  { name: 'Project Gamma', color: 'emerald' }
];

export const dailyReportDataMock = [
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

export const weeklyReportDataMock = [
  { week: '07-01\n13-01', endDate: '13-01', me: 1779598458, impression: 10251075, cpm: 173601, comments: 5288, commentsPerImp: 0.05, costPerComment: 336535, newMessages: 11041, newMessagesPerImp: 0.11, costPerNewMessage: 161181, sales: 671, salesPerImp: 0.0065, costPerSale: 2652159 },
  { week: '14-01\n20-01', endDate: '20-01', me: 0, impression: 0, cpm: 0, comments: 0, commentsPerImp: 0, costPerComment: 0, newMessages: 0, newMessagesPerImp: 0, costPerNewMessage: 0, sales: 0, salesPerImp: 0, costPerSale: 0 },
  { week: '21-01\n27-01', endDate: '27-01', me: 0, impression: 0, cpm: 0, comments: 0, commentsPerImp: 0, costPerComment: 0, newMessages: 0, newMessagesPerImp: 0, costPerNewMessage: 0, sales: 0, salesPerImp: 0, costPerSale: 0 },
  { week: '28-01\n03-02', endDate: '03-02', me: 0, impression: 0, cpm: 0, comments: 0, commentsPerImp: 0, costPerComment: 0, newMessages: 0, newMessagesPerImp: 0, costPerNewMessage: 0, sales: 0, salesPerImp: 0, costPerSale: 0 },
  { week: '04-02\n10-02', endDate: '10-02', me: 0, impression: 0, cpm: 0, comments: 0, commentsPerImp: 0, costPerComment: 0, newMessages: 0, newMessagesPerImp: 0, costPerNewMessage: 0, sales: 0, salesPerImp: 0, costPerSale: 0 },
  { week: '11-02\n17-02', endDate: '17-02', me: 0, impression: 0, cpm: 0, comments: 0, commentsPerImp: 0, costPerComment: 0, newMessages: 0, newMessagesPerImp: 0, costPerNewMessage: 0, sales: 0, salesPerImp: 0, costPerSale: 0 },
  { week: '18-02\n24-02', endDate: '24-02', me: 0, impression: 0, cpm: 0, comments: 0, commentsPerImp: 0, costPerComment: 0, newMessages: 0, newMessagesPerImp: 0, costPerNewMessage: 0, sales: 0, salesPerImp: 0, costPerSale: 0 },
  { week: '25-02\n03-03', endDate: '03-03', me: 0, impression: 0, cpm: 0, comments: 0, commentsPerImp: 0, costPerComment: 0, newMessages: 0, newMessagesPerImp: 0, costPerNewMessage: 0, sales: 3, salesPerImp: 0, costPerSale: 0 },
  { week: '04-03\n10-03', endDate: '10-03', me: 0, impression: 0, cpm: 0, comments: 0, commentsPerImp: 0, costPerComment: 0, newMessages: 0, newMessagesPerImp: 0, costPerNewMessage: 0, sales: 0, salesPerImp: 0, costPerSale: 0 },
];

export const monthlyReportDataMock = [
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

export const searchTermsMock: SearchTerm[] = [
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

export const searchTotalsMock = {
  totalConversions: 260.9,
  totalCostPerConv: '64.093,87 ₫',
  totalConvRate: '5,6%',
  totalCost: '16,72 Tr ₫',
  totalClicks: 4700,
  totalAvgCPC: '3.590,83 ₫',
  totalCTR: '3,64%',
  totalImpressions: 127835,
  totalAvgCPM: '130.785 ₫'
};

export const chartDataMock = {
  impressions: [4622, 5400, 4080, 4980, 5158, 5011, 6431],
  clicks: [291, 256, 234, 304, 254, 300, 260],
  conversions: [25, 26, 18, 45, 61, 41, 18],
  dates: ['21 thg 2, 2026', '22 thg 2, 2026', '23 thg 2, 2026', '24 thg 2, 2026', '25 thg 2, 2026', '26 thg 2, 2026', '27 thg 2, 2026']
};

export const employeeMetricsMock = [
  { name: 'Nguyen Van A', revenue: 4250000, cost: 1123443, orders: 1, leads: 4, messages: 17, adCostPercent: 26.43, closingRate: 25.00, contactRate: 23.53, avgOrderValue: 4250000, costPerOrder: 1123443, costPerLead: 280861, costPerMessage: 66085 },
  { name: 'Tran Thi B', revenue: 3800000, cost: 980000, orders: 2, leads: 5, messages: 20, adCostPercent: 25.79, closingRate: 10.00, contactRate: 25.00, avgOrderValue: 1900000, costPerOrder: 490000, costPerLead: 196000, costPerMessage: 49000 },
  { name: 'Le Van C', revenue: 5200000, cost: 1350000, orders: 3, leads: 6, messages: 24, adCostPercent: 25.96, closingRate: 12.50, contactRate: 25.00, avgOrderValue: 1733333, costPerOrder: 450000, costPerLead: 225000, costPerMessage: 56250 },
  { name: 'Pham Thi D', revenue: 4500000, cost: 1150000, orders: 2, leads: 5, messages: 19, adCostPercent: 25.56, closingRate: 10.53, contactRate: 26.32, avgOrderValue: 2250000, costPerOrder: 575000, costPerLead: 230000, costPerMessage: 60526 },
  { name: 'Hoang Van E', revenue: 4800000, cost: 1250000, orders: 3, leads: 7, messages: 22, adCostPercent: 26.04, closingRate: 13.64, contactRate: 31.82, avgOrderValue: 1600000, costPerOrder: 416667, costPerLead: 178571, costPerMessage: 56818 },
];

export const countriesMock = [
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
];
