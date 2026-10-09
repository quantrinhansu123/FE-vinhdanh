/**
 * Trang chủ — bảng xếp hạng nhân viên (vinh danh)
 */

import { useState } from 'react';
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
import type { MetaAdsLeaderboardAccount } from '../api/metaAds';

interface LeaderboardPageProps {
  employees: Employee[];
  /** Nguồn dữ liệu BXH: Fabico /api/employee/mkt hoặc Supabase employees */
  boardSource?: 'upcare' | 'supabase' | 'demo';
  boardLastSyncedAt: string | null;
  employeeBoardError?: string | null;
  adAccounts: MetaAdsLeaderboardAccount[];
  adAccountsError: string | null;
  adAccountsLastSyncedAt: string | null;
  loading: boolean;
  showMenuBar: boolean;
  setShowMenuBar: (v: boolean) => void;
  onLogout: () => void;
}

export function LeaderboardPage({
  employees,
  boardSource = 'supabase',
  boardLastSyncedAt,
  employeeBoardError = null,
  adAccounts,
  adAccountsError,
  adAccountsLastSyncedAt,
  loading,
  showMenuBar,
  setShowMenuBar,
  onLogout,
}: LeaderboardPageProps) {
  const [boardType, setBoardType] = useState<'employees' | 'ads'>('employees');
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const currencyGroups = [...new Set(adAccounts.map((account) => account.currency || 'UNKNOWN'))].sort();
  const activeCurrency = currencyGroups.includes(selectedCurrency) ? selectedCurrency : currencyGroups[0] || '';
  const activeEmployees: Employee[] = boardType === 'employees'
    ? employees
    : adAccounts
      .filter((account) => (account.currency || 'UNKNOWN') === activeCurrency)
      .sort((a, b) => b.purchase_value - a.purchase_value || a.account_id.localeCompare(b.account_id))
      .map((account, index) => ({
        id: `meta-account-${account.account_id}`,
        name: account.account_name || `act_${account.account_id}`,
        code: account.account_id,
        team: account.currency || 'Chưa rõ tiền tệ',
        score: account.purchase_value,
        avatar_url: null,
        rank: index + 1,
      }));
  const top3 = activeEmployees.slice(0, 3);
  const podiumOrder = [
    top3.find((e) => e.rank === 3),
    top3.find((e) => e.rank === 1),
    top3.find((e) => e.rank === 2),
  ].filter(Boolean) as Employee[];

  const others = activeEmployees.slice(3);
  const boardHeading = boardType === 'ads'
    ? `Purchase Meta · ${activeCurrency === 'UNKNOWN' ? 'chưa rõ tiền tệ' : activeCurrency}`
    : boardSource === 'demo'
      ? 'Dữ liệu giả lập · 20 nhân viên'
    : boardSource === 'upcare'
      ? 'Doanh số Sale — Odoo (7 ngày gần nhất)'
      : 'Bảng xếp hạng nhân viên';
  const scoreCaption = boardType === 'ads'
    ? 'Purchase Meta'
    : boardSource === 'upcare'
      ? 'Doanh số Sale'
      : boardSource === 'demo'
        ? 'Doanh số Demo'
        : 'Điểm';
  const scoreSuffix = boardType === 'ads' && activeCurrency !== 'UNKNOWN' ? ` ${activeCurrency}` : '';

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

      <header className="relative z-20 mb-4 w-full pt-6 pb-2 flex flex-col items-center justify-center">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setBoardType('employees')}
            className={`rounded-full border px-4 py-2 text-xs font-bold backdrop-blur-md transition ${boardType === 'employees' ? 'border-yellow-300/70 bg-yellow-400/20 text-yellow-100' : 'border-white/15 bg-black/35 text-white/70 hover:bg-black/55'}`}
          >
            Nhân viên · Odoo
          </button>
          <button
            type="button"
            onClick={() => setBoardType('ads')}
            className={`rounded-full border px-4 py-2 text-xs font-bold backdrop-blur-md transition ${boardType === 'ads' ? 'border-cyan-300/70 bg-cyan-400/20 text-cyan-100' : 'border-white/15 bg-black/35 text-white/70 hover:bg-black/55'}`}
          >
            Tài khoản Ads · Meta
          </button>
          {boardType === 'ads' && currencyGroups.length > 1 ? (
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {currencyGroups.map((currency) => (
                <button
                  key={currency}
                  type="button"
                  onClick={() => setSelectedCurrency(currency)}
                  className={`rounded-full border px-3 py-1.5 text-[10px] font-bold backdrop-blur-md transition ${activeCurrency === currency ? 'border-cyan-200/70 bg-cyan-400/20 text-cyan-100' : 'border-white/15 bg-black/35 text-white/65 hover:bg-black/55'}`}
                >
                  {currency === 'UNKNOWN' ? 'Chưa rõ tiền tệ' : currency}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </header>

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

              {boardType === 'ads' ? (
                <div className="relative z-10 text-center text-[10px] text-cyan-100/80 uppercase tracking-widest mb-1 lg:mb-0 lg:absolute lg:top-2">
                  {boardHeading}
                  {adAccountsLastSyncedAt ? <span className="ml-2 normal-case tracking-normal text-white/45">· cập nhật {new Date(adAccountsLastSyncedAt).toLocaleString('vi-VN')}</span> : null}
                </div>
              ) : boardSource === 'upcare' ? (
                <p className="relative z-10 text-center text-[10px] text-cyan-200/70 uppercase tracking-widest mb-1 lg:mb-0 lg:absolute lg:top-2">
                  {boardHeading}
                  {boardLastSyncedAt ? <span className="ml-2 normal-case tracking-normal text-white/45">· snapshot {new Date(boardLastSyncedAt).toLocaleString('vi-VN')}</span> : null}
                </p>
              ) : null}

              {boardType === 'ads' && adAccountsError ? (
                <div className="relative z-20 mx-auto max-w-xl rounded-xl border border-white/15 bg-black/55 px-5 py-4 text-center text-xs text-white/80 backdrop-blur-md">
                  {adAccountsError}
                </div>
              ) : boardType === 'employees' && employeeBoardError ? (
                <div className="relative z-20 mx-auto max-w-xl rounded-xl border border-amber-300/30 bg-black/55 px-5 py-4 text-center text-xs text-amber-100 backdrop-blur-md">
                  {employeeBoardError}
                </div>
              ) : activeEmployees.length === 0 ? (
                <div className="relative z-20 mx-auto max-w-xl rounded-xl border border-white/15 bg-black/55 px-5 py-4 text-center text-xs text-white/80 backdrop-blur-md">
                  {boardType === 'ads' ? 'Chưa có dữ liệu Meta Ads trong khoảng ngày này. Chạy đồng bộ để nạp doanh số purchase.' : 'Chưa có dữ liệu nhân viên.'}
                </div>
              ) : (
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
                      <WinnerCard winner={winner} isCenter={winner.rank === 1} scoreCaption={scoreCaption} scoreSuffix={scoreSuffix} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="hidden lg:flex absolute right-4 top-4 bottom-4 w-[280px] xl:w-[320px] flex-col z-30">
              <div className="w-full bg-black/50 backdrop-blur-md rounded-2xl border border-white/15 overflow-hidden shadow-2xl flex flex-col h-full">
                <div className="px-3 py-2 border-b border-white/10 bg-white/5 flex items-center justify-between shrink-0">
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Trophy size={14} className="text-yellow-400" />
                      {boardType === 'ads' ? 'Tài khoản Ads' : 'Bảng Xếp Hạng'}
                    </h2>
                    {boardType === 'ads' ? (
                      <p className="text-[8px] text-cyan-300/80 font-normal normal-case tracking-normal mt-0.5 truncate" title="Giá trị purchase do Meta ghi nhận, theo tiền tệ từng tài khoản">
                        Meta purchase · {activeCurrency === 'UNKNOWN' ? 'tiền tệ chưa rõ' : activeCurrency}
                      </p>
                    ) : boardSource === 'demo' ? (
                      <p className="text-[8px] text-amber-200/80 font-normal normal-case tracking-normal mt-0.5 truncate">
                        Dữ liệu giả lập · 20 nhân viên
                      </p>
                    ) : boardSource === 'upcare' ? (
                      <p className="text-[8px] text-cyan-300/80 font-normal normal-case tracking-normal mt-0.5 truncate" title="Doanh số Odoo theo khoảng 7 ngày gần nhất">
                        Odoo Sale · 7 ngày{boardLastSyncedAt ? ` · snapshot ${new Date(boardLastSyncedAt).toLocaleString('vi-VN')}` : ''}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-white/40 text-[9px] font-mono shrink-0">TOP 4 - {activeEmployees.length}</div>
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
                            {boardType === 'ads' ? <span className="text-[8px] text-white/45 font-mono truncate">{winner.code}</span> : null}
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

function WinnerCard({
  winner,
  isCenter = false,
  scoreCaption = 'Doanh số',
  scoreSuffix = '',
}: {
  winner: Employee;
  isCenter?: boolean;
  scoreCaption?: string;
  scoreSuffix?: string;
}) {
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
          {scoreCaption}: {winner.score.toLocaleString()}{scoreSuffix}
        </div>
      </div>
    </motion.div>
  );
}
