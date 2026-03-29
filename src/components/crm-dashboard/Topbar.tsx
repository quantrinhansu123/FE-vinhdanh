import React, { useState, useEffect } from 'react';

interface TopbarProps {
  title: string;
  onToggleNotif: () => void;
  hasNewNotif: boolean;
}

export const Topbar: React.FC<TopbarProps> = ({ title, onToggleNotif, hasNewNotif }) => {
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () => {
      const n = new Date();
      const p = (x: number) => String(x).padStart(2, '0');
      const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
      const formatted = `${days[n.getDay()]} ${p(n.getDate())}/${p(n.getMonth() + 1)} ${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`;
      setTime(formatted);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-[var(--th)] shrink-0 bg-[var(--bg1)] border-b border-[var(--border)] flex items-center px-[12px] gap-[12px]">
      <div className="text-[14px] font-extrabold tracking-[0.2px] text-[var(--text)]">
        {title}
      </div>
      
      <div className="ml-auto flex items-center gap-[8px]">
        <select className="bg-[var(--bg2)] border border-[var(--border)] rounded-[6px] text-[var(--text2)] font-[var(--f)] text-[11px] p-[4px_8px] cursor-pointer outline-none">
          <option>Tất cả dự án</option>
          <option>BIOKAMA</option>
          <option>FABICO</option>
          <option>MASSHU</option>
          <option>YASU</option>
        </select>
        
        <select className="bg-[var(--bg2)] border border-[var(--border)] rounded-[6px] text-[var(--text2)] font-[var(--f)] text-[11px] p-[4px_8px] cursor-pointer outline-none">
          <option>Tháng này</option>
          <option>Tuần này</option>
          <option>Hôm nay</option>
          <option>Tháng trước</option>
        </select>
        
        <div className="flex items-center gap-[5px] bg-[var(--Gd)] border border-[var(--Gb)] p-[4px_10px] rounded-[20px] text-[9.5px] font-bold tracking-[0.8px] text-[var(--G)]">
          <div className="w-[5px] h-[5px] rounded-full bg-[var(--G)] animate-pulse" />
          LIVE
        </div>
        
        <div className="font-[var(--mono)] text-[11px] text-[var(--text3)] bg-[var(--bg2)] border border-[var(--border)] p-[4px_10px] rounded-[6px] tracking-[0.5px] whitespace-nowrap min-w-[120px] text-center">
          {time}
        </div>
        
        <button 
          onClick={onToggleNotif}
          className="w-[30px] h-[30px] rounded-[7px] border border-[var(--border)] bg-transparent text-[var(--text2)] cursor-pointer flex items-center justify-center text-[13px] relative transition-all duration-150 hover:bg-[var(--bg3)]"
        >
          🔔
          {hasNewNotif && (
            <div className="absolute top-[5px] right-[5px] w-[6px] h-[6px] rounded-full bg-[var(--R)] border-[1.5px] border-[var(--bg1)]" />
          )}
        </button>
      </div>
    </div>
  );
};
