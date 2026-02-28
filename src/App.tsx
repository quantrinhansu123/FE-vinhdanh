/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import { Trophy, Crown, Star, Medal } from 'lucide-react';

// Mock Data matching the image
const WINNERS = [
  { 
    id: 1, 
    name: 'Ms THÁI MINH KHUÊ', 
    team: 'Alpha', 
    rank: 1, 
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    score: 9850
  },
  { 
    id: 2, 
    name: 'Ms NGUYỄN NHẬT MINH', 
    team: 'Beta', 
    rank: 2, 
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    score: 8920
  },
  { 
    id: 3, 
    name: 'Mr NGUYỄN TRẦN MINH HUY', 
    team: 'Gama', 
    rank: 3, 
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    score: 8540
  },
];

// Mock Data for other ranks
const OTHER_WINNERS = [
  { id: 4, name: 'Emily Davis', team: 'Delta', rank: 4, score: 8100, avatar: 'https://picsum.photos/seed/emily/200' },
  { id: 5, name: 'Chris Wilson', team: 'Alpha', rank: 5, score: 7950, avatar: 'https://picsum.photos/seed/chris/200' },
  { id: 6, name: 'Jessica Taylor', team: 'Beta', rank: 6, score: 7820, avatar: 'https://picsum.photos/seed/jessica/200' },
  { id: 7, name: 'David Miller', team: 'Gama', rank: 7, score: 7750, avatar: 'https://picsum.photos/seed/david/200' },
  { id: 8, name: 'Robert Wilson', team: 'Delta', rank: 8, score: 7640, avatar: 'https://picsum.photos/seed/robert/200' },
  { id: 9, name: 'Lisa Anderson', team: 'Alpha', rank: 9, score: 7590, avatar: 'https://picsum.photos/seed/lisa/200' },
  { id: 10, name: 'James Martin', team: 'Beta', rank: 10, score: 7450, avatar: 'https://picsum.photos/seed/james/200' },
  { id: 11, name: 'William Thompson', team: 'Gama', rank: 11, score: 7320, avatar: 'https://picsum.photos/seed/william/200' },
  { id: 12, name: 'Sophia Martinez', team: 'Delta', rank: 12, score: 7210, avatar: 'https://picsum.photos/seed/sophia/200' },
  { id: 13, name: 'Daniel White', team: 'Alpha', rank: 13, score: 7100, avatar: 'https://picsum.photos/seed/daniel/200' },
  { id: 14, name: 'Olivia Brown', team: 'Beta', rank: 14, score: 7050, avatar: 'https://picsum.photos/seed/olivia/200' },
  { id: 15, name: 'Lucas Garcia', team: 'Gama', rank: 15, score: 6980, avatar: 'https://picsum.photos/seed/lucas/200' },
];

export default function App() {
  return (
    <div className="min-h-screen w-full bg-[#004D25] flex flex-col items-center p-0 font-sans overflow-hidden relative">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Radial Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[80vw] bg-emerald-400/20 rounded-full blur-[120px]" />
        
        {/* Particles/Sparkles (Simulated) */}
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-yellow-400 rounded-full blur-[1px] animate-pulse" />
        <div className="absolute top-1/3 right-1/3 w-3 h-3 bg-yellow-200 rounded-full blur-[2px] animate-pulse delay-75" />
        <div className="absolute bottom-1/4 left-1/3 w-2 h-2 bg-yellow-300 rounded-full blur-[1px] animate-pulse delay-150" />
        <div className="absolute top-20 right-20 w-1 h-1 bg-white rounded-full blur-[0px] animate-ping" />
        
        {/* Bottom Golden Waves/Curtains (Simulated with gradients) */}
        <div className="absolute bottom-0 left-0 w-full h-64 bg-gradient-to-t from-[#C49102]/20 to-transparent" />
        <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-[#FDB931]/10 blur-[80px] rounded-full" />
        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-[#FDB931]/10 blur-[80px] rounded-full" />
      </div>

      {/* Header - Compact */}
      <header className="relative z-20 mb-4 w-full pt-6 pb-2 flex flex-col md:flex-row items-center justify-center gap-6">
        {/* Logo */}
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="flex-shrink-0"
        >
           <div className="relative group cursor-pointer">
              {/* Glow behind the logo */}
              <div className="absolute inset-0 bg-white/30 blur-3xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
              
              <img 
                src="https://www.appsheet.com/template/gettablefileurl?appName=Appsheet-325045268&tableName=Kho%20%E1%BA%A3nh&fileName=Kho%20%E1%BA%A3nh_Images%2Fd3e93e8d.%E1%BA%A2nh.121830.png" 
                alt="Logo" 
                className="h-20 lg:h-28 w-auto object-contain relative z-10 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] hover:scale-105 transition-transform duration-300"
              />
           </div>
        </motion.div>

        <div className="text-center md:text-left">
          <motion.h1 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl md:text-2xl lg:text-3xl font-extrabold uppercase tracking-wide text-white drop-shadow-lg leading-tight"
          >
            Vinh Danh Đội Nhóm Xuất Sắc Nhất
          </motion.h1>
          <div className="mt-1 flex justify-center md:justify-start">
            <div className="h-1 w-24 bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />
          </div>
        </div>
      </header>

      {/* Main Content - Custom Flex Layout - No Gap */}
      <div className="relative z-10 w-full h-full flex-1 flex flex-col lg:flex-row items-stretch justify-center gap-0 px-0 pb-0 max-w-[1920px]">
        
        {/* Left Panel: Podium (70%) */}
        <div className="w-full lg:w-[70%] flex flex-col justify-center bg-white/5 backdrop-blur-sm rounded-t-[24px] lg:rounded-l-[24px] lg:rounded-tr-none border border-white/5 border-r-0 p-4 shadow-xl relative overflow-hidden">
          {/* Subtle background glow for podium */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-b from-yellow-500/5 to-transparent pointer-events-none" />
          
          <div className="flex items-end justify-center gap-2 md:gap-8 w-full h-full pb-12 lg:pb-32 relative z-10">
            {/* Rank 3 (Left) */}
            <div className="order-1 transform translate-y-4">
              <WinnerCard winner={WINNERS[2]} />
            </div>

            {/* Rank 1 (Center) */}
            <div className="order-2 -mt-4 z-20 transform -translate-y-12">
              <WinnerCard winner={WINNERS[0]} isCenter />
            </div>

            {/* Rank 2 (Right) */}
            <div className="order-3 transform translate-y-4">
              <WinnerCard winner={WINNERS[1]} />
            </div>
          </div>
        </div>

        {/* Right Panel: Other Winners List (30%) */}
        <div className="w-full lg:w-[30%] flex flex-col">
          <div className="w-full bg-black/20 backdrop-blur-md rounded-b-[24px] lg:rounded-r-[24px] lg:rounded-bl-none border border-white/10 overflow-hidden shadow-2xl flex flex-col h-full max-h-[calc(100vh-60px)]">
            {/* List Header Title */}
            <div className="px-4 py-2 border-b border-white/10 bg-white/5 flex items-center justify-between shrink-0">
              <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Trophy size={16} className="text-yellow-400" />
                Bảng Xếp Hạng
              </h2>
              <div className="text-white/40 text-[10px] font-mono">TOP 4 - 15</div>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-black/20 text-yellow-400/80 font-bold uppercase tracking-wider text-[10px] sticky top-0 z-10 backdrop-blur-sm shrink-0">
              <div className="col-span-2 text-center">Rank</div>
              <div className="col-span-6">Name</div>
              <div className="col-span-4 text-right">Team</div>
            </div>
            
            <div className="overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent p-2">
              <div className="space-y-1">
                {OTHER_WINNERS.map((winner, index) => (
                  <motion.div 
                    key={winner.id}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.05 }}
                    className="grid grid-cols-12 gap-2 px-3 py-2 items-center bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all rounded-md group"
                  >
                    <div className="col-span-2 flex justify-center">
                      <div className="w-5 h-5 rounded-full bg-black/20 border border-white/10 group-hover:border-yellow-400/50 flex items-center justify-center text-white font-bold text-[10px] transition-colors">
                        {winner.rank}
                      </div>
                    </div>
                    <div className="col-span-6 flex items-center gap-2">
                      <img src={winner.avatar} alt={winner.name} className="w-6 h-6 rounded-full border border-white/20 object-cover" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-white font-semibold text-xs truncate">{winner.name}</span>
                      </div>
                    </div>
                    <div className="col-span-4 flex justify-end items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-900/50 border border-emerald-500/30 text-emerald-200 text-[9px] font-medium truncate max-w-[60px] text-center">
                        {winner.team}
                      </span>
                      <span className="hidden xl:block text-yellow-400 font-mono font-bold text-xs">{winner.score.toLocaleString()}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function WinnerCard({ winner, isCenter = false }: { winner: typeof WINNERS[0], isCenter?: boolean }) {
  // Sizes
  const containerSize = isCenter ? "w-48 h-48 lg:w-60 lg:h-60" : "w-36 h-36 lg:w-44 lg:h-44";
  const crownSize = isCenter ? 56 : 36;
  
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: winner.rank * 0.2, type: "spring", stiffness: 100 }}
      className="flex flex-col items-center relative z-10 group"
    >
      {/* Floating Crown - Perfectly centered above frame */}
      <motion.div 
        animate={{ y: [0, -8, 0] }}
        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
        className="absolute -top-12 lg:-top-16 z-20 filter drop-shadow-[0_0_15px_rgba(253,186,49,0.8)]"
      >
        <Crown size={crownSize} className="text-[#FFD700] fill-[#FFD700]" strokeWidth={1} />
      </motion.div>

      {/* Main Avatar Container */}
      <div className={`relative ${containerSize} flex items-center justify-center`}>
        
        {/* Ambient Glow */}
        <div className="absolute inset-0 bg-[#FFD700]/20 rounded-full blur-3xl transform scale-125" />

        {/* Premium Royal Frame SVG */}
        <div className="absolute inset-[-35%] pointer-events-none z-10">
          <svg viewBox="0 0 300 300" className="w-full h-full drop-shadow-2xl" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              {/* Luxurious Gold Gradients */}
              <linearGradient id={`royal-gold-${winner.id}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#FDB931" />
                <stop offset="25%" stopColor="#FFFFE0" />
                <stop offset="50%" stopColor="#BF953F" />
                <stop offset="75%" stopColor="#B8860B" />
                <stop offset="100%" stopColor="#8B4513" />
              </linearGradient>
              <linearGradient id={`dark-gold-${winner.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#B8860B" />
                <stop offset="100%" stopColor="#8B4513" />
              </linearGradient>
              <filter id="metal-glow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            
            {/* Outer Decorative Flourishes (Stylized Wings/Leaves) */}
            <g stroke={`url(#royal-gold-${winner.id})`} strokeWidth="2" fill="none" opacity="0.8">
               <path d="M50 150 Q30 100 80 50" strokeWidth="4" strokeLinecap="round" />
               <path d="M250 150 Q270 100 220 50" strokeWidth="4" strokeLinecap="round" />
               <path d="M40 180 Q20 130 60 220" strokeWidth="3" />
               <path d="M260 180 Q280 130 240 220" strokeWidth="3" />
            </g>

            {/* Main Circular Frame Ring */}
            <circle cx="150" cy="150" r="105" stroke={`url(#dark-gold-${winner.id})`} strokeWidth="8" fill="none" />
            <circle cx="150" cy="150" r="100" stroke={`url(#royal-gold-${winner.id})`} strokeWidth="6" fill="none" filter="url(#metal-glow)" />
            
            {/* Inner Bevel Ring */}
            <circle cx="150" cy="150" r="92" stroke="#FFF" strokeOpacity="0.3" strokeWidth="1" fill="none" />
            
            {/* Bottom Ornament (Rank Holder Base) */}
            <path 
              d="M100 240 Q150 270 200 240 L190 220 Q150 240 110 220 Z" 
              fill={`url(#royal-gold-${winner.id})`} 
              filter="url(#metal-glow)"
            />
          </svg>
        </div>

        {/* Avatar Image */}
        <div className="w-full h-full rounded-full p-2 relative z-0">
          <div className="w-full h-full rounded-full overflow-hidden bg-gray-900 shadow-inner relative">
            <img 
              src={winner.avatar} 
              alt={winner.name} 
              className="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-110"
            />
            {/* Inner Shadow Overlay for depth */}
            <div className="absolute inset-0 rounded-full shadow-[inset_0_0_20px_rgba(0,0,0,0.6)] pointer-events-none" />
          </div>
        </div>

        {/* Rank Badge - Integrated into Frame */}
        <div className="absolute -bottom-8 z-20 flex flex-col items-center">
             {/* Gem/Badge Container */}
             <div className={`
               ${isCenter ? 'w-16 h-16' : 'w-12 h-12'} 
               rounded-full bg-gradient-to-b from-[#D00000] to-[#8B0000]
               border-[3px] border-[#FFD700] shadow-[0_5px_15px_rgba(0,0,0,0.5)] 
               flex flex-col items-center justify-center relative overflow-hidden
             `}>
               {/* Shine effect on gem */}
               <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-gradient-to-br from-white/30 to-transparent rotate-45 pointer-events-none" />
               
               <span className="text-white font-black text-2xl leading-none drop-shadow-md relative z-10">{winner.rank}</span>
               <span className="text-white/90 font-bold text-[8px] uppercase leading-none mt-0.5 relative z-10">TOP</span>
             </div>
             
             {/* Decorative Ribbon Below Badge */}
             <div className="mt-[-10px] -z-10">
                <svg width="120" height="40" viewBox="0 0 120 40" fill="none">
                  <path d="M10 10 L30 10 L40 25 L30 40 L10 40 L0 25 Z" fill="#8B0000" />
                  <path d="M110 10 L90 10 L80 25 L90 40 L110 40 L120 25 Z" fill="#8B0000" />
                </svg>
             </div>
        </div>
      </div>

      {/* Name & Team Info */}
      <div className="mt-12 text-center flex flex-col items-center w-64">
        <h3 className="text-transparent bg-clip-text bg-gradient-to-r from-[#FFD700] via-[#FFF] to-[#FFD700] font-black text-sm lg:text-base uppercase tracking-wider drop-shadow-sm whitespace-nowrap overflow-hidden text-ellipsis w-full filter drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
          {winner.name}
        </h3>
        <div className="mt-1 flex flex-col items-center">
           <div className="flex items-center gap-2">
              <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-yellow-500/50" />
              <span className="text-yellow-100/80 font-serif italic text-xs lg:text-sm">Team {winner.team}</span>
              <div className="h-[1px] w-8 bg-gradient-to-l from-transparent to-yellow-500/50" />
           </div>
           <div className="mt-1 text-yellow-400 font-bold text-xs lg:text-sm bg-black/20 px-3 py-0.5 rounded-full border border-yellow-500/20 backdrop-blur-sm">
             Doanh số: {winner.score.toLocaleString()}
           </div>
        </div>
      </div>
    </motion.div>
  );
}



