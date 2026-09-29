/**
 * Trang chủ — bảng xếp hạng nhân viên (vinh danh)
 */

import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import {
  Trophy,
  Loader2,
  LogOut,
  Menu,
  EyeOff,
  LayoutDashboard,
} from 'lucide-react';

import backgroundImg from '../assets/background.png';
import top1Img from '../assets/top1.png';
import top2Img from '../assets/top2.png';
import top3Img from '../assets/top3.png';

import type { Employee } from '../types';
import { StitchBadge } from '../components/ui/StitchUI';

interface LeaderboardPageProps {
  employees: Employee[];
  /** Nguồn dữ liệu BXH: Fabico /api/employee/mkt hoặc Supabase employees */
  boardSource?: 'upcare' | 'supabase';
  loading: boolean;
  showMenuBar: boolean;
  setShowMenuBar: (v: boolean) => void;
  onLogout: () => void;
}

export function LeaderboardPage({
  employees,
  boardSource = 'supabase',
  loading,
  showMenuBar,
  setShowMenuBar,
  onLogout,
}: LeaderboardPageProps) {
  const top3 = employees.slice(0, 3);
  const podiumOrder = [
    top3.find((e) => e.rank === 3),
    top3.find((e) => e.rank === 1),
    top3.find((e) => e.rank === 2),
  ].filter(Boolean) as Employee[];

  const others = employees.slice(3);

  return (
    <div className="stitch-system stitch-public-page stitch-leaderboard-page">
      <header className="stitch-public-header">
        <div className="stitch-public-brand"><span>MAP</span><div><strong>Marketing Analytics</strong><small>Performance workspace</small></div></div>
        <div className="stitch-public-actions">
          <button type="button" onClick={() => setShowMenuBar(!showMenuBar)} className="stitch-public-action" title={showMenuBar ? 'Ẩn menu' : 'Hiện menu'} aria-expanded={showMenuBar}>
            {showMenuBar ? <EyeOff size={17} /> : <Menu size={17} />}<span>Menu</span>
          </button>
          <AnimatePresence>
            {showMenuBar && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
                <Link to="/crm-admin/admin-dash" className="stitch-public-action"><LayoutDashboard size={17} /><span>CRM Admin</span></Link>
              </motion.div>
            )}
          </AnimatePresence>
          <button type="button" onClick={onLogout} className="stitch-public-action"><LogOut size={17} /><span>Đăng xuất</span></button>
        </div>
      </header>

      <main className="stitch-leaderboard-main">
        <section className="stitch-leaderboard-intro">
          <div><span className="stitch-leaderboard-kicker"><Trophy size={14} /> Vinh danh hiệu suất</span><h1>Bảng xếp hạng Marketing</h1><p>Ghi nhận những cá nhân tạo ra kết quả nổi bật trong kỳ báo cáo.</p></div>
          <StitchBadge tone="success">{boardSource === 'upcare' ? 'Fabico MKT · 7 ngày' : 'Dữ liệu nội bộ'}</StitchBadge>
        </section>

        {loading ? (
          <div className="stitch-leaderboard-loading"><Loader2 className="animate-spin" size={28} /><strong>Đang tải dữ liệu</strong><span>Hệ thống đang tổng hợp thứ hạng mới nhất…</span></div>
        ) : (
          <div className="stitch-leaderboard-grid">
            <section className="stitch-podium-card">
              <div className="stitch-podium-card-head"><div><span>Top performers</span><h2>Gương mặt dẫn đầu</h2></div><strong>{employees.length} thành viên</strong></div>
              <div className="stitch-podium-backdrop" style={{ backgroundImage: `url(${backgroundImg})` }} aria-hidden="true" />
              {podiumOrder.length ? (
                <div className="stitch-podium-list">
                  {podiumOrder.map((winner) => <WinnerCard key={winner.id} winner={winner} isCenter={winner.rank === 1} />)}
                </div>
              ) : <div className="stitch-public-empty"><Trophy size={28} /><strong>Chưa có dữ liệu xếp hạng</strong><span>Kết quả sẽ xuất hiện khi hệ thống có báo cáo.</span></div>}
            </section>

            <section className="stitch-ranking-card">
              <div className="stitch-ranking-head"><div><span>Thứ hạng tiếp theo</span><h2>Toàn đội</h2></div><Trophy size={20} /></div>
              <div className="stitch-ranking-labels"><span>Hạng</span><span>Nhân sự</span><span>Kết quả</span></div>
              <div className="stitch-ranking-list">
                {others.length ? others.map((winner, index) => (
                  <motion.article key={winner.id} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.035 }} className="stitch-ranking-row">
                    <strong className="stitch-ranking-number">{winner.rank}</strong>
                    <div className="stitch-ranking-person"><img src={winner.avatar_url || 'https://via.placeholder.com/150'} alt="" /><span><strong>{winner.name}</strong><small>Team {winner.team}</small></span></div>
                    <span className="stitch-ranking-score">{winner.score.toLocaleString()}</span>
                  </motion.article>
                )) : <div className="stitch-ranking-empty">Chưa có thứ hạng tiếp theo.</div>}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function WinnerCard({ winner, isCenter = false }: { winner: Employee; isCenter?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: (winner.rank || 3) * 0.2, type: 'spring', stiffness: 100 }}
      className={`stitch-winner stitch-winner--${winner.rank} ${isCenter ? 'is-center' : ''}`}
    >
      <div className="stitch-winner-portrait">
        <img className="stitch-winner-avatar" src={winner.avatar_url || 'https://via.placeholder.com/300'} alt={winner.name} />
        <img className="stitch-winner-frame" src={winner.rank === 1 ? top1Img : winner.rank === 2 ? top2Img : top3Img} alt="" aria-hidden="true" />
        <span className="stitch-winner-rank">#{winner.rank}</span>
      </div>
      <div className="stitch-winner-copy"><h3>{winner.name}</h3><p>Team {winner.team}</p><strong>{winner.score.toLocaleString()}<small> doanh số</small></strong></div>
    </motion.div>
  );
}
