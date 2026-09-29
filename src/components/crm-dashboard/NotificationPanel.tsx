import React from 'react';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ isOpen, onClose }) => {
  return (
    <div 
      className={`stitch-system stitch-notification-panel fixed right-0 z-50 overflow-y-auto transition-transform duration-200 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="stitch-notification-head">
        <div><span>Trung tâm cập nhật</span><strong>Thông báo</strong></div>
        <button 
          onClick={onClose}
          className="stitch-icon-button"
          aria-label="Đóng thông báo"
        >
          ✕
        </button>
      </div>
      
      <div className="stitch-notification-empty"><span aria-hidden="true">✓</span><strong>Bạn đã cập nhật</strong><p>Chưa có thông báo mới.</p></div>
    </div>
  );
};
