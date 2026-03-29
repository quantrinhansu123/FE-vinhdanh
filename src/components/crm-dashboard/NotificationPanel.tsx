import React from 'react';
import { AlertItem } from './atoms/SharedAtoms';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ isOpen, onClose }) => {
  return (
    <div 
      className={`fixed top-[var(--th)] right-0 w-[300px] h-[calc(100vh-var(--th))] bg-[var(--bg1)] border-l border-[var(--border)] z-50 overflow-y-auto p-[14px] transition-transform duration-200 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="flex items-center justify-between mb-[12px]">
        <div className="text-[13px] font-extrabold text-[var(--text)]">🔔 Thông báo</div>
        <button 
          onClick={onClose}
          className="bg-transparent border-0 text-[var(--text3)] cursor-pointer text-[16px] hover:text-[var(--text)]"
        >
          ✕
        </button>
      </div>
      
      <div className="flex flex-col gap-[7px]">
        <AlertItem 
          title="MKT C — Ads/DT 68%" 
          description="Burn Score 84 · 2 phút trước" 
          statusText="Nguy hiểm" 
          statusType="R" 
        />
        <AlertItem 
          title="MKT A — Ads/DT 58%" 
          description="Burn Score 78 · 5 phút trước" 
          statusText="Nguy hiểm" 
          statusType="R" 
        />
        <AlertItem 
          title="2 MKT chưa nhập báo cáo" 
          description="Deadline 22:00 · 20 phút trước" 
          statusText="Nhắc nhở" 
          statusType="Y" 
        />
        <AlertItem 
          title="Yêu cầu ngân sách — 150M" 
          description="Team A · Media One · 1h trước" 
          statusText="Cần làm" 
          statusType="Y" 
        />
      </div>
    </div>
  );
};
