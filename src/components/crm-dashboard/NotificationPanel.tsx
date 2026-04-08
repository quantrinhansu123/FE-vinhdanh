import React from 'react';

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
      
      <div className="flex flex-col gap-[7px] text-[12px] text-[var(--text3)] py-4 px-1">Chưa có thông báo.</div>
    </div>
  );
};
