import { useEffect, useRef, useState } from 'react';
import { Bars, ChartIcon, KpiMark, RankBadge, SaleAvatar, ShieldIcon, Spark, TargetIcon, TrendIcon, TrophyIcon } from './bits';
import {
  BU_COLORS,
  FABICO_CONFIG,
  KPI_SPARK,
  clamp,
  createDemoDashboard,
  loadDashboard,
  money,
  number,
  pct,
  sortSales,
  type DashboardData,
  type PeriodKey,
  type SaleRow,
} from './dashboardData';

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: 'Hôm Nay' },
  { key: 'week', label: '7 Ngày' },
  { key: 'month', label: 'Tháng Này' },
];

const BU_OPTIONS = ['all', 'FALCON', 'LION', 'WOLF', 'TITAN', 'PHOENIX'];

const PERIOD_LABEL = { today: 'hôm nay', week: 'trong 7 ngày', month: 'trong tháng' } as const;
const BU_PERIOD_LABEL = { today: 'Doanh số hôm nay', week: 'Doanh số 7 ngày', month: 'Doanh số tháng' } as const;

function LogoMark() {
  return (
    <svg viewBox="0 0 50 50" aria-hidden>
      <defs>
        <linearGradient id="fabico-arena-logo" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#32fff0" />
          <stop offset="1" stopColor="#048dff" />
        </linearGradient>
      </defs>
      <path fill="url(#fabico-arena-logo)" d="M9 5h34l-2 10H20l-2 8h19l-2 10H16l-3 13H2z" />
    </svg>
  );
}

export function FabicoArenaDashboard() {
  const [period, setPeriod] = useState<PeriodKey>('today');
  const [bu, setBu] = useState('all');
  const [tableBu, setTableBu] = useState('all');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<DashboardData | null>(() => createDemoDashboard());
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeError, setNoticeError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [connection, setConnection] = useState(FABICO_CONFIG.apiUrl ? 'ĐÃ KẾT NỐI API' : 'DỮ LIỆU MẪU');
  const [caption, setCaption] = useState('Dữ liệu minh họa · Sẵn sàng kết nối API');
  const [now, setNow] = useState(() => new Date());
  const [reloadKey, setReloadKey] = useState(0);
  const [growthBy, setGrowthBy] = useState<'growth' | 'revenue'>('growth');
  const [cleanBy, setCleanBy] = useState<'return' | 'orders'>('return');
  const requestRef = useRef(0);
  const hasDataRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!FABICO_CONFIG.apiUrl) {
      setData(createDemoDashboard({ period, bu }));
      setNotice(null);
      setNoticeError(false);
      setLoading(false);
      setConnection('DỮ LIỆU MẪU');
      setCaption('Dữ liệu minh họa · Chưa kết nối database');
      return;
    }
    const requestId = ++requestRef.current;
    setNotice('Đang tải dữ liệu…');
    setNoticeError(false);
    setLoading(true);
    loadDashboard({ period, bu })
      .then((next) => {
        if (requestId !== requestRef.current) return;
        setData(next);
        hasDataRef.current = true;
        setNotice(null);
        setConnection(FABICO_CONFIG.apiUrl ? 'ĐÃ KẾT NỐI API' : 'DỮ LIỆU MẪU');
        setCaption(
          FABICO_CONFIG.apiUrl
            ? `Dữ liệu từ API · Cập nhật ${new Date().toLocaleTimeString('vi-VN')}`
            : 'Dữ liệu minh họa · Chưa kết nối database',
        );
      })
      .catch((error: unknown) => {
        if (requestId !== requestRef.current) return;
        const name = error instanceof Error ? error.name : '';
        const message = error instanceof Error ? error.message : 'Không tải được dữ liệu.';
        setNoticeError(true);
        setNotice(
          `Không tải được dữ liệu. ${name === 'AbortError' ? 'Kết nối quá thời gian chờ.' : message} Nhấn Làm mới để thử lại.`,
        );
        setConnection('LỖI KẾT NỐI');
        if (hasDataRef.current) {
          setCaption('Đang hiển thị dữ liệu lần tải trước · Bộ lọc mới chưa được áp dụng');
        }
      })
      .finally(() => {
        if (requestId === requestRef.current) setLoading(false);
      });
  }, [period, bu, reloadKey]);

  const ranked = data ? sortSales(data.sales).map((sale, index) => ({ ...sale, rank: index + 1 })) : [];
  const visible = ranked.filter(
    (sale) =>
      (tableBu === 'all' || sale.bu === tableBu) &&
      sale.name.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')),
  );
  const tabNames = ['all', ...new Set(['FALCON', 'LION', 'WOLF', 'TITAN', 'PHOENIX', ...(data?.sales.map((sale) => sale.bu) ?? [])])];
  const top = data ? sortSales(data.sales).slice(0, 3) : [];
  const growth = data
    ? [...data.sales]
        .sort((a, b) => (growthBy === 'revenue' ? b.revenue - a.revenue : b.growth - a.growth))
        .slice(0, 3)
    : [];
  const clean = data
    ? [...data.sales]
        .sort((a, b) => (cleanBy === 'orders' ? b.orders - a.orders : a.returnRate - b.returnRate))
        .slice(0, 3)
    : [];
  const buRows = data ? [...data.buRanking].sort((a, b) => b.revenue - a.revenue) : [];
  const buMax = Math.max(...buRows.map((item) => item.revenue), 1);

  return (
    <div className="fabico-arena" style={{ minHeight: '100vh' }}>
      <div className="dashboard">
        <header className="masthead">
          <div className="brand">
            <LogoMark />
            <div>
              <h1>
                FABICO <em>SALE ARENA</em>
              </h1>
              <p>Dashboard Vinh Danh &amp; Đua Top Sale</p>
            </div>
          </div>
          <div className="live">
            <i />
            <span>{connection}</span>
          </div>
          <time dateTime={now.toISOString()}>
            {now.toLocaleTimeString('vi-VN')}
            {'  '}
            {now.toLocaleDateString('vi-VN')}
          </time>
          <div className="header-controls">
            <div className="segmented">
              {PERIODS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={period === item.key ? 'active' : undefined}
                  aria-pressed={period === item.key}
                  onClick={() => setPeriod(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <select
              aria-label="Lọc đơn vị kinh doanh"
              value={bu}
              onChange={(event) => {
                setBu(event.target.value);
                setTableBu('all');
              }}
            >
              {BU_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === 'all' ? 'Tất cả BU' : option}
                </option>
              ))}
            </select>
          </div>
          <div className="company">
            <span>F.</span>
            <div>
              <b>FABICO</b>
              <small>Sales Performance Center</small>
            </div>
          </div>
        </header>

        {notice ? (
          <div id="notice" className={noticeError ? 'error' : undefined} role="status">
            {notice}
          </div>
        ) : null}

        {data ? <KpiGrid data={data} period={period} /> : null}

        <main className={loading ? 'main-grid loading' : 'main-grid'} aria-busy={loading}>
          <div className="left-column">
            <section className="panel arena">
              <div className="section-heading">
                <span className="heading-icon gold">
                  <TrophyIcon />
                </span>
                <div>
                  <h2>TOP 3 CHIẾN BINH XUẤT SẮC NHẤT</h2>
                  <p>Vinh danh những cá nhân có doanh số cao nhất {PERIOD_LABEL[period]}</p>
                </div>
                <a href="#ranking">
                  Xem bảng xếp hạng đầy đủ <span>→</span>
                </a>
              </div>
              <div className="company-wing">
                <span id="arena-company">{FABICO_CONFIG.companyName}</span>
              </div>
              <div className="quote-wing">
                <blockquote id="arena-quote">{FABICO_CONFIG.arenaQuote}</blockquote>
              </div>
              <div className="arena-scene">
                <div className="stage-word">FABICO</div>
                <div className="podiums">
                  {[2, 1, 3].map((rank) => {
                    const sale = top[rank - 1];
                    return (
                      <article key={rank} className={`stage-winner place-${rank}`} aria-label={`Top ${rank}`}>
                        {sale ? (
                          <>
                            <div className="stage-avatar">
                              <SaleAvatar sale={sale} className="stage-face" />
                            </div>
                            <div className="stage-name" title={sale.name}>
                              {sale.name}
                            </div>
                            <div className="stage-bu">BU {sale.bu}</div>
                            <div className="stage-revenue">{money(sale.revenue)}</div>
                            <div className="stage-metrics">
                              <div>
                                <b>{pct(sale.conversion)}</b>
                                <small>Tỷ lệ chốt</small>
                              </div>
                              <div>
                                <b>{pct(sale.kpi)}</b>
                                <small>Hoàn thành KPI</small>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="stage-name">Chưa có dữ liệu</div>
                        )}
                      </article>
                    );
                  })}
                  <div className="stage-medals" aria-hidden>
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
              </div>
            </section>

            <section className="panel ranking" id="ranking">
              <div className="ranking-heading">
                <div className="section-heading">
                  <span className="heading-icon">
                    <ChartIcon />
                  </span>
                  <div>
                    <h2>BẢNG XẾP HẠNG CHIẾN BINH FABICO</h2>
                    <p>Cạnh tranh công bằng · Học hỏi người dẫn đầu · Tăng tỷ lệ chốt đơn mỗi ngày</p>
                  </div>
                </div>
                <div className="table-controls">
                  <div className="tabs">
                    {tabNames.map((name) => (
                      <button
                        key={name}
                        type="button"
                        className={tableBu === name ? 'active' : undefined}
                        aria-pressed={tableBu === name}
                        onClick={() => setTableBu(name)}
                      >
                        {name === 'all' ? 'Tất cả' : name}
                      </button>
                    ))}
                  </div>
                  <label className="search">
                    <input
                      placeholder="Tìm kiếm sale..."
                      aria-label="Tìm kiếm nhân viên"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                    <span>⌕</span>
                  </label>
                </div>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>HẠNG</th>
                      <th>SALE</th>
                      <th>BU</th>
                      <th>LEAD</th>
                      <th>ĐƠN CHỐT</th>
                      <th>DOANH SỐ</th>
                      <th>TỶ LỆ CHỐT</th>
                      <th>KPI HOÀN THÀNH</th>
                      <th>XU HƯỚNG</th>
                      <th>TRẠNG THÁI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((sale) => (
                      <tr key={sale.id}>
                        <td>
                          <RankBadge rank={sale.rank} />
                        </td>
                        <td>
                          <div className="person">
                            <SaleAvatar sale={sale} />
                            <b title={sale.name}>{sale.name}</b>
                          </div>
                        </td>
                        <td className="bu-text">{sale.bu}</td>
                        <td>{number(sale.leads)}</td>
                        <td>{number(sale.orders)}</td>
                        <td className="revenue">{money(sale.revenue)}</td>
                        <td className="conversion">{pct(sale.conversion)}</td>
                        <td>
                          <div className="kpi-cell">
                            <b>{pct(sale.kpi)}</b>
                            <div className="progress-track">
                              <div className="progress-fill" style={{ width: `${clamp(sale.kpi / 1.5)}%` }} />
                            </div>
                          </div>
                        </td>
                        <td>
                          <Spark values={sale.trend} />
                        </td>
                        <td>
                          <span className={sale.status === 'watch' ? 'status watch' : 'status'}>
                            {sale.status === 'watch' ? 'CẦN THEO DÕI' : 'ĐẠT'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {visible.length === 0 ? <div id="empty">Không có nhân viên phù hợp.</div> : null}
            </section>
          </div>

          <aside className="right-column">
            <section className="panel bu-panel">
              <div className="side-heading">
                <h2>
                  <span className="gold">
                    <TrophyIcon />
                  </span>{' '}
                  BẢNG XẾP HẠNG THEO BU
                </h2>
                <small>{BU_PERIOD_LABEL[period]}</small>
              </div>
              <div>
                {buRows.map((item, index) => (
                  <div
                    key={item.name}
                    className="bu-row"
                    style={{
                      ['--bu-color' as string]: BU_COLORS[index % BU_COLORS.length],
                      ['--width' as string]: `${clamp((item.revenue / buMax) * 90)}%`,
                    }}
                  >
                    <span className="bu-symbol">♟</span>
                    <b>{item.name}</b>
                    <div className="bu-bar">
                      <i />
                    </div>
                    <span className="amount">{money(item.revenue)}</span>
                    <strong>{number(item.kpi)}%</strong>
                  </div>
                ))}
              </div>
            </section>

            {data ? <TargetCards data={data} /> : null}

            <section className="panel side-list">
              <div className="side-heading">
                <h2>
                  <span className="icon-trend">
                    <TrendIcon />
                  </span>
                  <span className="side-title">TOP CHIẾN BINH BỨT PHÁ</span>
                </h2>
                <select
                  className="side-select"
                  aria-label="Chọn tiêu chí bứt phá"
                  value={growthBy}
                  onChange={(event) => setGrowthBy(event.target.value as 'growth' | 'revenue')}
                >
                  <option value="growth">Tăng trưởng doanh số</option>
                  <option value="revenue">Doanh số</option>
                </select>
              </div>
              <div>
                {growth.map((sale, index) => (
                  <SidePerson key={sale.id} sale={sale} rank={index + 1} />
                ))}
              </div>
            </section>

            <section className="panel side-list">
              <div className="side-heading">
                <h2>
                  <span className="icon-shield">
                    <ShieldIcon />
                  </span>
                  <span className="side-title">
                    SALE ĐƠN SẠCH <small>(TỶ LỆ HOÀN THẤP NHẤT)</small>
                  </span>
                </h2>
                <select
                  className="side-select"
                  aria-label="Chọn tiêu chí đơn sạch"
                  value={cleanBy}
                  onChange={(event) => setCleanBy(event.target.value as 'return' | 'orders')}
                >
                  <option value="return">Tỷ lệ hoàn/hủy</option>
                  <option value="orders">Số đơn</option>
                </select>
              </div>
              <div>
                {clean.map((sale, index) => (
                  <div key={sale.id} className="side-person clean-person">
                    <div>
                      <RankBadge rank={index + 1} />
                    </div>
                    <div className="person">
                      <SaleAvatar sale={sale} />
                      <div>
                        <b>{sale.name}</b>
                        <small>BU {sale.bu}</small>
                      </div>
                    </div>
                    <span className="increase">{pct(sale.returnRate)}</span>
                    <span className="orders">{number(sale.orders)} đơn</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </main>

        <footer>
          <span>{caption}</span>
          <button type="button" onClick={() => setReloadKey((value) => value + 1)}>
            ↻ Làm mới
          </button>
        </footer>
      </div>
    </div>
  );
}

function KpiGrid({ data, period }: { data: DashboardData; period: PeriodKey }) {
  const summary = data.summary;
  const items: Array<[string, string, string, string, string]> = [
    ['◉', 'DOANH SỐ HÔM NAY', money(summary.revenue), '12.5', '#32baff'],
    ['▤', 'DOANH THU THỰC NHẬN', money(summary.received), '8.8', '#ffd15c'],
    ['◎', 'TỶ LỆ CHỐT ĐƠN', pct(summary.conversion), '-3.3', '#21e2de'],
    ['♟', 'LEAD HỢP LỆ', number(summary.leads), '12.4', '#008cff'],
    ['⊗', 'TỶ LỆ HOÀN / HỦY', pct(summary.returnRate), '-1.2', '#ff65ab'],
    ['⚑', 'KPI HOÀN THÀNH', pct(summary.kpi), '5.8', '#ffe071'],
  ];

  return (
    <section className="kpi-grid" aria-label="Chỉ số tổng quan">
      {items.map((item, index) => (
        <article key={item[1]} className="kpi-card" style={{ ['--accent' as string]: item[4] }}>
          <span className="kpi-icon" aria-hidden>
            <KpiMark index={index} />
          </span>
          <div className="kpi-label">{index === 0 && period !== 'today' ? 'DOANH SỐ TRONG KỲ' : item[1]}</div>
          <div className="kpi-value">{item[2]}</div>
          <div className={index === 2 ? 'delta negative' : 'delta'}>
            {FABICO_CONFIG.apiUrl ? (
              'Theo kỳ đang chọn'
            ) : (
              <>
                <strong>
                  {index === 2 ? '↓' : '↑'} {item[3]}%
                </strong>{' '}
                {index === 2 ? '(mục tiêu 25%)' : 'so với hôm qua'}
              </>
            )}
          </div>
          {index === 5 ? (
            <div className="kpi-ring">
              <div>{pct(summary.kpi)}</div>
            </div>
          ) : index === 3 || index === 4 ? (
            <Bars color={item[4]} />
          ) : (
            <Spark values={KPI_SPARK} color={item[4]} area className="kpi-chart" />
          )}
        </article>
      ))}
    </section>
  );
}

function TargetCards({ data }: { data: DashboardData }) {
  const progress = data.target.amount > 0 ? (data.target.achieved / data.target.amount) * 100 : 0;
  return (
    <div className="target-grid">
      <section className="panel target-card">
        <span className="target-icon">
          <TargetIcon />
        </span>
        <div className="target-title">MỤC TIÊU PHÒNG KINH DOANH</div>
        <div className="target-value">
          {money(data.target.amount)} <span>USD</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${clamp(progress)}%` }} />
        </div>
        <div className="target-note">
          <b>Đã đạt {pct(progress)}</b>
          <span>Kỳ đang chọn</span>
        </div>
      </section>
      <section className="panel target-card">
        <span className="target-icon icon-bars">
          <ChartIcon variant="rise" />
        </span>
        <div className="target-title">CẦN THÊM ĐỂ ĐẠT 25%</div>
        <div className="target-value">
          {number(data.target.neededLeads)} <span>lead chốt</span>
        </div>
        <p>
          Cần thêm {number(data.target.neededOrders)} lead chốt
          <br />
          Từ {number(data.target.neededLeads)} lead hợp lệ để đạt 25%
        </p>
      </section>
    </div>
  );
}

function SidePerson({ sale, rank }: { sale: SaleRow; rank: number }) {
  return (
    <div className="side-person">
      <div>
        <RankBadge rank={rank} />
      </div>
      <div className="person">
        <SaleAvatar sale={sale} />
        <div>
          <b>{sale.name}</b>
          <small>BU {sale.bu}</small>
        </div>
      </div>
      <span className="increase">
        {sale.growth >= 0 ? '+' : ''}
        {number(sale.growth)}%
      </span>
      <span>{money(sale.revenue)}</span>
      <Spark values={sale.trend} color="#43ebc4" />
    </div>
  );
}
