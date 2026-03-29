import React from 'react';
import { SectionCard, Badge } from '../../../components/crm-dashboard/atoms/SharedAtoms';

export const MktAccountsView: React.FC = () => {
  const accountData = [
    {
      id: 'TK-001',
      name: 'FB Ads BIOKAMA Main',
      agency: 'Media One',
      currency: 'VNĐ',
      fanpage: 'BIOKAMA Official',
      startDate: '01/01/2025',
      status: 'Active',
      statusType: 'G' as const
    },
    {
      id: 'TK-002',
      name: 'FB Ads BIOKAMA Backup',
      agency: 'Media One',
      currency: 'VNĐ',
      fanpage: 'BK Nông Nghiệp',
      startDate: '01/01/2025',
      status: 'Active',
      statusType: 'G' as const
    }
  ];

  return (
    <div className="dash-fade-up">
      <SectionCard title="🎯 Tài khoản Ads của tôi">
        <div className="flex flex-col gap-[12px]">
          {accountData.map((acc, idx) => (
            <div 
              key={idx} 
              className="bg-[var(--bg3)] border border-[var(--border)] rounded-[12px] p-[16px_20px] flex items-center gap-[24px] transition-all hover:bg-[rgba(255,255,255,0.015)] hover:border-[rgba(61,142,240,0.3)] group"
            >
              <div className="font-[var(--mono)] text-[11.5px] text-[var(--accent)] font-black w-[80px] shrink-0">
                {acc.id}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-black text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
                  {acc.name}
                </div>
                <div className="text-[10.5px] text-[var(--text3)] mt-[4px] flex items-center gap-[6px] overflow-hidden truncate">
                  <span>{acc.agency}</span>
                  <span className="opacity-30">·</span>
                  <span>{acc.currency}</span>
                  <span className="opacity-30">·</span>
                  <span>Fanpage: {acc.fanpage}</span>
                  <span className="opacity-30">·</span>
                  <span>Bắt đầu: {acc.startDate}</span>
                </div>
              </div>
              <div className="shrink-0">
                <Badge type={acc.statusType}>{acc.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
};
