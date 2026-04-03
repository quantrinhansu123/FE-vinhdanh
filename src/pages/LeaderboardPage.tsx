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

interface LeaderboardPageProps {
  employees: Employee[];
  loading: boolean;
  showMenuBar: boolean;
  setShowMenuBar: (v: boolean) => void;
  onLogout: () => void;
}

export function LeaderboardPage({
  employees,
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

  const navBtn =
    'px-3 py-2 bg-black/40 hover:bg-black/60 text-white/80 hover:text-white rounded-xl transition-all border border-white/10 backdrop-blur-md text-xs font-semibold flex items-center gap-1';

  return (
    <div className="min-h-screen w-full flex flex-col items-center p-0 font-sans antialiased overflow-hidden relative">
      <div
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage: `url(${backgroundImg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />

      <button
        type="button"
        onClick={() => setShowMenuBar(!showMenuBar)}
        className="absolute top-4 left-4 z-50 p-2 bg-black/40 hover:bg-black/60 text-white/70 hover:text-white rounded-full transition-all border border-white/10 backdrop-blur-md"
        title={showMenuBar ? 'Ẩn menu' : 'Hiện menu'}
      >
        {showMenuBar ? <EyeOff size={20} /> : <Menu size={20} />}
      </button>

      <AnimatePresence>
        {showMenuBar && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="absolute top-4 left-16 z-50 flex flex-wrap gap-2 max-w-[calc(100vw-5rem)]"
          >
            <Link to="/crm-admin/admin-dash" className={navBtn}>
              <LayoutDashboard size={14} /> CRM Admin
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={onLogout}
        className="absolute top-4 right-4 z-50 px-3 py-2 bg-black/40 hover:bg-black/60 text-white/80 hover:text-white rounded-xl transition-all border border-white/10 backdrop-blur-md text-xs font-semibold flex items-center gap-1"
      >
        <LogOut size={14} /> Đăng xuất
      </button>

      <header className="relative z-20 mb-4 w-full pt-6 pb-2 flex flex-col items-center justify-center" />

      <div className="relative z-10 w-full flex-1 flex flex-col items-center justify-center px-0 pb-0">
        {loading ? (
          <div className="flex flex-col items-center gap-4 text-white">
            <Loader2 className="animate-spin text-yellow-400" size={48} />
            <p className="font-bold tracking-widest uppercase bg-black/20 px-4 py-1 rounded-full backdrop-blur-sm">Đang tải dữ liệu...</p>
          </div>
        ) : (
          <>
            <div className="w-full flex flex-col items-center justify-center bg-transparent p-4 relative overflow-hidden flex-1">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-b from-yellow-500/5 to-transparent pointer-events-none" />

              <div className="flex items-end justify-center gap-20 lg:gap-32 w-full h-full pb-12 lg:pb-32 relative z-10 transform translate-y-[90px] -translate-x-[120px]">
                {podiumOrder.map((winner) => (
                  <div
                    key={winner.id}
                    className={`${
                      winner.rank === 1
                        ? 'order-2 -mt-4 z-20 transform -translate-y-12'
                        : winner.rank === 2
                          ? 'order-3 transform translate-y-4'
                          : 'order-1 transform translate-y-4'
                    }`}
                  >
                    <WinnerCard winner={winner} isCenter={winner.rank === 1} />
                  </div>
                ))}
              </div>
            </div>

            <div className="hidden lg:flex absolute right-4 top-4 bottom-4 w-[280px] xl:w-[320px] flex-col z-30">
              <div className="w-full bg-black/50 backdrop-blur-md rounded-2xl border border-white/15 overflow-hidden shadow-2xl flex flex-col h-full">
                <div className="px-3 py-2 border-b border-white/10 bg-white/5 flex items-center justify-between shrink-0">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Trophy size={14} className="text-yellow-400" />
                    Bảng Xếp Hạng
                  </h2>
                  <div className="text-white/40 text-[9px] font-mono">TOP 4 - {employees.length}</div>
                </div>

                <div className="grid grid-cols-12 gap-1 px-2.5 py-2 bg-black/20 text-yellow-400/80 font-bold uppercase tracking-wider text-[11px] sticky top-0 z-10 backdrop-blur-sm shrink-0">
                  <div className="col-span-2 text-center">Rank</div>
                  <div className="col-span-6">Name</div>
                  <div className="col-span-4 text-right">Team</div>
                </div>

                <div className="overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent p-1.5">
                  <div className="space-y-0.5">
                    {others.map((winner, index) => (
                      <motion.div
                        key={winner.id}
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.05 }}
                        className="grid grid-cols-12 gap-1 px-2 py-1.5 items-center bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all rounded-md group"
                      >
                        <div className="col-span-2 flex justify-center">
                          <div className="w-6 h-6 rounded-full bg-black/20 border border-white/10 group-hover:border-yellow-400/50 flex items-center justify-center text-white font-bold text-[11px] transition-colors">
                            {winner.rank}
                          </div>
                        </div>
                        <div className="col-span-6 flex items-center gap-2">
                          <img
                            src={winner.avatar_url || 'https://via.placeholder.com/150'}
                            alt={winner.name}
                            className="w-6 h-6 rounded-full border border-white/20 object-cover flex-shrink-0"
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="text-white font-semibold text-[12px] truncate">{winner.name}</span>
                          </div>
                        </div>
                        <div className="col-span-4 flex justify-end items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-900/50 border border-emerald-500/30 text-emerald-200 text-[10px] font-medium truncate max-w-[60px] text-center">
                            {winner.team}
                          </span>
                          <span className="hidden xl:block text-yellow-400 font-mono font-bold text-[12px]">{winner.score.toLocaleString()}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function WinnerCard({ winner, isCenter = false }: { winner: Employee; isCenter?: boolean }) {
  const containerSize = isCenter ? 'w-48 h-48 lg:w-60 lg:h-60' : 'w-36 h-36 lg:w-44 lg:h-44';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: (winner.rank || 3) * 0.2, type: 'spring', stiffness: 100 }}
      className="flex flex-col items-center relative z-10 group"
    >
      <div className={`relative ${containerSize} flex items-center justify-center`}>
        <div className="absolute inset-0 bg-[#FFD700]/5 rounded-full transform scale-125" />
        <div className="w-[84%] h-[84%] rounded-full p-0 relative z-0 top-[-14%]">
          <div className="w-full h-full rounded-full overflow-hidden bg-gray-900 shadow-inner relative">
            <img
              src={winner.avatar_url || 'https://via.placeholder.com/300'}
              alt={winner.name}
              className="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-110"
            />
            <div className="absolute inset-0 rounded-full shadow-[inset_0_0_20px_rgba(0,0,0,0.6)] pointer-events-none" />
          </div>
        </div>

        <div className="absolute inset-[-42%] pointer-events-none z-10">
          <img
            src={winner.rank === 1 ? top1Img : winner.rank === 2 ? top2Img : top3Img}
            alt={`Rank ${winner.rank} frame`}
            className="w-full h-full object-contain drop-shadow-2xl"
          />
        </div>
        <div className={`absolute ${winner.rank === 1 ? 'bottom-[calc(0%+10px)]' : 'bottom-[3%]'} z-20 w-[120%] text-center`}>
          <h3
            className={`text-[#4D3302] font-black ${
              winner.rank === 1 ? 'text-[12px] lg:text-[15px]' : 'text-[10px] lg:text-[12px]'
            } uppercase tracking-tighter truncate px-2`}
          >
            {winner.name}
          </h3>
        </div>

        <div className={`absolute ${winner.rank === 1 ? 'bottom-[-26%]' : 'bottom-[-26%]'} z-20 w-full text-center`}>
          <span
            className={`text-[#4D3302] font-bold ${
              winner.rank === 1 ? 'text-[12px] lg:text-[15px]' : 'text-[9px] lg:text-[12px]'
            } uppercase`}
          >
            Team {winner.team}
          </span>
        </div>
      </div>

      <div className={`${isCenter ? 'mt-20' : 'mt-14'} text-center flex flex-col items-center`}>
        <div className="mt-1 text-yellow-400 font-bold text-xs lg:text-sm bg-black/40 px-3 py-0.5 rounded-full border-2 border-white backdrop-blur-sm shadow-[0_0_20px_rgba(255,255,255,0.6),inset_0_0_10px_rgba(255,255,255,0.2)]">
          Doanh số: {winner.score.toLocaleString()}
        </div>
      </div>
    </motion.div>
  );
}
