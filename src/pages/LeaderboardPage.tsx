import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EyeOff, LayoutDashboard, Loader2, LogOut, Menu } from 'lucide-react';
import { ChartIcon, RankBadge, SaleAvatar, TrophyIcon } from '../components/pages/fabico-sale-arena/bits';
import { FABICO_CONFIG } from '../components/pages/fabico-sale-arena/dashboardData';
import '../components/pages/fabico-sale-arena/arena.css';
import './leaderboard.css';
import type { Employee } from '../types';

interface LeaderboardPageProps {
  employees: Employee[];
  boardSource?: 'upcare' | 'supabase' | 'unavailable';
  boardError?: string | null;
  loading: boolean;
  showMenuBar: boolean;
  setShowMenuBar: (v: boolean) => void;
  onLogout: () => void;
}

const formatScore = new Intl.NumberFormat('vi-VN');
const teamName = (employee: Employee) => employee.team?.trim() || 'Chưa có team';
const avatar = (employee: Employee) => ({ name: employee.name, avatar: employee.avatar_url || '' });

export function LeaderboardPage({
  employees,
  boardSource = 'supabase',
  boardError,
  loading,
  showMenuBar,
  setShowMenuBar,
  onLogout,
}: LeaderboardPageProps) {
  const [query, setQuery] = useState('');
  const [team, setTeam] = useState('');
  const teamScores = new Map<string, number>();
  for (const employee of employees) {
    const name = teamName(employee);
    teamScores.set(name, (teamScores.get(name) ?? 0) + employee.score);
  }
  const teams = [...teamScores].sort((a, b) => b[1] - a[1]);
  const maxTeamScore = Math.max(1, teams[0]?.[1] ?? 0);
  const search = query.trim().toLocaleLowerCase('vi');
  const visible = employees.filter((employee) =>
    (!team || !teamScores.has(team) || teamName(employee) === team) &&
    employee.name.toLocaleLowerCase('vi').includes(search),
  );
  const sourceLabel = boardSource === 'upcare' ? 'Fabico MKT · 7 ngày gần nhất' : 'Dữ liệu nhân viên · Supabase';

  return (
    <div className="fabico-arena fabico-leaderboard">
      <div className="dashboard">
        <header className="masthead">
          <div className="brand">
            <TrophyIcon />
            <div>
              <h1>FABICO <em>SALE ARENA</em></h1>
              <p>Vinh danh nhân viên xuất sắc</p>
            </div>
          </div>
          <nav className="header-controls" aria-label="Điều hướng trang Vinh danh">
            <button type="button" aria-controls="leaderboard-menu" aria-expanded={showMenuBar} aria-label={showMenuBar ? 'Ẩn menu' : 'Hiện menu'} onClick={() => setShowMenuBar(!showMenuBar)}>
              {showMenuBar ? <EyeOff size={16} aria-hidden /> : <Menu size={16} aria-hidden />}
            </button>
            <div id="leaderboard-menu" hidden={!showMenuBar}>
              <Link to="/crm-admin/admin-dash"><LayoutDashboard size={16} aria-hidden /> CRM Admin</Link>
            </div>
            <button type="button" onClick={onLogout}><LogOut size={16} aria-hidden /> Đăng xuất</button>
          </nav>
        </header>

        <main aria-busy={loading}>
          {loading ? (
            <div className="panel board-notice" role="status"><Loader2 size={20} className="animate-spin" aria-hidden /> Đang tải dữ liệu…</div>
          ) : boardSource === 'unavailable' ? (
            <div className="panel board-notice" role="status">
              Chưa thể xếp hạng vì không tải được doanh số Odoo{boardError ? `: ${boardError}` : '.'}
            </div>
          ) : employees.length === 0 ? (
            <div className="panel board-notice" role="status">Chưa có dữ liệu xếp hạng.</div>
          ) : (
            <div className="main-grid">
              <div className="left-column">
                <section className="panel arena" aria-labelledby="leaderboard-podium-title">
                  <div className="section-heading">
                    <span className="heading-icon gold"><TrophyIcon /></span>
                    <div>
                      <h2 id="leaderboard-podium-title">TOP 3 CHIẾN BINH XUẤT SẮC NHẤT</h2>
                      <p>{sourceLabel}</p>
                    </div>
                    <a href="#ranking">Xem bảng xếp hạng <span aria-hidden>→</span></a>
                  </div>
                  <div className="company-wing" aria-hidden><span id="arena-company">{FABICO_CONFIG.companyName}</span></div>
                  <div className="quote-wing" aria-hidden><blockquote id="arena-quote">{FABICO_CONFIG.arenaQuote}</blockquote></div>
                  <div className="arena-scene">
                    <div className="podiums">
                      {[2, 1, 3].map((rank) => {
                        const winner = employees.find((employee) => employee.rank === rank);
                        return (
                          <article key={rank} className={`stage-winner place-${rank}`} aria-label={`Top ${rank}`}>
                            {winner ? (
                              <>
                                <div className="stage-avatar"><SaleAvatar key={winner.avatar_url} sale={avatar(winner)} className="stage-face" /></div>
                                <div className="stage-name" title={winner.name}>{winner.name}</div>
                                <div className="stage-bu">{teamName(winner)}</div>
                                <div className="stage-revenue">{formatScore.format(winner.score)}</div>
                              </>
                            ) : <div className="stage-name">Chưa có dữ liệu</div>}
                          </article>
                        );
                      })}
                    </div>
                  </div>
                </section>

                <section className="panel ranking" id="ranking" aria-labelledby="leaderboard-ranking-title">
                  <div className="ranking-heading">
                    <div className="section-heading">
                      <span className="heading-icon"><ChartIcon /></span>
                      <div>
                        <h2 id="leaderboard-ranking-title">BẢNG XẾP HẠNG NHÂN VIÊN</h2>
                        <p>{employees.length} nhân viên · {sourceLabel}</p>
                      </div>
                    </div>
                    <div className="board-filters">
                      <select aria-label="Lọc theo team" value={teamScores.has(team) ? team : ''} onChange={(event) => setTeam(event.target.value)}>
                        <option value="">Tất cả team</option>
                        {teams.map(([name]) => <option key={name}>{name}</option>)}
                      </select>
                      <label className="search">
                        <input type="search" aria-label="Tìm kiếm nhân viên" placeholder="Tìm nhân viên…" value={query} onChange={(event) => setQuery(event.target.value)} />
                      </label>
                    </div>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead><tr><th scope="col">Hạng</th><th scope="col">Nhân viên</th><th scope="col">Team</th><th scope="col">Doanh số</th></tr></thead>
                      <tbody>
                        {visible.map((employee) => (
                          <tr key={employee.id}>
                            <td>{employee.rank != null ? <RankBadge rank={employee.rank} /> : '–'}</td>
                            <td><div className="person"><SaleAvatar key={employee.avatar_url} sale={avatar(employee)} /><b>{employee.name}</b></div></td>
                            <td className="bu-text">{teamName(employee)}</td>
                            <td className="revenue">{formatScore.format(employee.score)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {visible.length === 0 && <div className="board-notice" role="status">Không có nhân viên phù hợp.</div>}
                </section>
              </div>
              <aside className="right-column">
                <section className="panel bu-panel" aria-labelledby="leaderboard-team-title">
                  <div className="side-heading">
                    <h2 id="leaderboard-team-title"><span className="gold"><TrophyIcon /></span> XẾP HẠNG THEO TEAM</h2>
                    <small>Doanh số</small>
                  </div>
                  {teams.map(([name, score], index) => (
                    <div key={name} className="bu-row">
                      <span>{index + 1}</span>
                      <b>{name}</b>
                      <div className="bu-bar" aria-hidden><i style={{ width: `${Math.max(0, score / maxTeamScore) * 100}%` }} /></div>
                      <span className="amount">{formatScore.format(score)}</span>
                    </div>
                  ))}
                </section>
              </aside>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
