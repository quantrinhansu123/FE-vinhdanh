import { motion } from 'motion/react';
import { MIcon } from '../../components/common/MIcon';

export function ReconcileHistoryPage() {
  return (
    <div id="crm-reconcile-history" className="crm-glass-card rounded-2xl overflow-hidden shadow-2xl border border-crm-outline/30 mt-6 min-h-[400px] flex flex-col items-center justify-center p-12 text-center">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-20 h-20 bg-crm-primary/10 rounded-full flex items-center justify-center mb-6"
      >
        <MIcon name="history" className="text-4xl text-crm-primary" />
      </motion.div>
      <h3 className="text-2xl font-bold text-crm-on-surface mb-2">Lịch sử chỉnh sửa</h3>
      <p className="text-crm-on-surface-variant max-w-md mx-auto leading-relaxed">
        Tính năng theo dõi lịch sử chỉnh sửa các bản ghi đối chiếu đang được hoàn thiện.
        Vui lòng quay lại sau để xem chi tiết các thay đổi.
      </p>
      <div className="mt-8 flex gap-3">
        <div className="px-4 py-2 bg-crm-surface-accent rounded-lg border border-crm-outline/30 text-xs font-bold uppercase tracking-wider text-crm-on-surface-variant">
          Version 1.2
        </div>
        <div className="px-4 py-2 bg-crm-primary/10 rounded-lg border border-crm-primary/30 text-xs font-bold uppercase tracking-wider text-crm-primary">
          In Development
        </div>
      </div>
    </div>
  );
}
