import React from 'react';
import { KpiCard } from '../../../components/crm-dashboard/atoms/KpiCard';
import { SectionCard, AlertItem } from '../../../components/crm-dashboard/atoms/SharedAtoms';

export const AlertsView: React.FC = () => {
  return (
    <div className="dash-fade-up">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-[10px] mb-[14px]">
        <KpiCard label="Nguy hiểm" value="3" sub="Cần xử lý ngay" animationDelay={0} barColor="var(--R)" valueColor="var(--R)" />
        <KpiCard label="Cần chú ý" value="4" sub="Trong 24h" animationDelay={0.03} barColor="var(--Y)" valueColor="var(--Y)" />
        <KpiCard label="Ổn định" value="11" sub="Marketing OK" animationDelay={0.06} barColor="var(--G)" valueColor="var(--G)" />
      </div>
      
      <SectionCard title="🚨 7 Cảnh báo hệ thống">
        <div className="flex flex-col gap-[7px]">
          <AlertItem 
            title="CA-1: Ads/DT vượt ngưỡng đỏ >45%" 
            description="MKT C (68%) · MKT A (58%) · MASSHU, BIOKAMA · Phát hiện 14:32" 
            statusText="Nguy hiểm" 
            statusType="R" 
          />
          <AlertItem 
            title="CA-2: Lead cao nhưng doanh số thấp" 
            description="MKT A — 62 lead, chỉ 17.7% chốt · Kiểm tra chất lượng lead" 
            statusText="Nguy hiểm" 
            statusType="R" 
          />
          <AlertItem 
            title="CA-7: TK ads chưa gắn agency" 
            description="TK-004 · ID #4812 · BIOKAMA · Chưa thiết lập đầy đủ" 
            statusText="Thiết lập" 
            statusType="R" 
          />
          <AlertItem 
            title="CA-1: MKT chưa nhập báo cáo cuối ngày" 
            description="Nguyễn Văn A, Trần Thị B · Deadline 22:00 · Còn 4 tiếng" 
            statusText="Nhắc nhở" 
            statusType="Y" 
          />
          <AlertItem 
            title="CA-6: Chênh lệch ngân sách nạp vs khai báo lớn" 
            description="TK-002 — Nạp 80M · Khai báo 52M · Chênh 28M (35%)" 
            statusText="Theo dõi" 
            statusType="Y" 
          />
          <AlertItem 
            title="CA-2: MKT nhập chi phí nhưng CRM chưa có lead" 
            description="Đinh Hoàng Nam · Chi 15M · 0 lead ngày 25/03 · Kiểm tra fanpage" 
            statusText="Bất thường" 
            statusType="Y" 
          />
          <AlertItem 
            title="CA-4: Doanh số có nhưng không có số mess" 
            description="Lê Thị Hoa · 3 đơn · mess = 0 · Ngày 24/03 · Cần xác minh" 
            statusText="Bất thường" 
            statusType="Y" 
          />
        </div>
      </SectionCard>
    </div>
  );
};
