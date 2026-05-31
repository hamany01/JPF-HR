import React from 'react';
import { MessageSquare, Calendar, ArrowUpRight } from 'lucide-react';
import { motion } from 'motion/react';

interface ActivityItem {
  id: string;
  requestId: string;
  requestSerialNumber?: string;
  content: string;
  createdAt: any; // Timestamp or Date
  category?: string;
}

interface RecentActivityProps {
  items: ActivityItem[];
  onViewRequest: (requestId: string) => void;
}

export default function RecentActivity({ items, onViewRequest }: RecentActivityProps) {
  const formatRelativeTime = (timestamp: any) => {
    if (!timestamp) return 'منذ فترة';
    
    let date: Date;
    if (typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    } else {
      date = new Date(timestamp);
    }

    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'الآن';
    if (diffInSeconds < 3600) return `منذ ${Math.floor(diffInSeconds / 60)} دقيقة`;
    if (diffInSeconds < 86400) return `منذ ${Math.floor(diffInSeconds / 3600)} ساعة`;
    if (diffInSeconds < 172800) return 'أمس';
    
    return date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' });
  };

  return (
    <div className="space-y-4 text-right" dir="rtl">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <h3 className="text-sm font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-indigo-500" />
          <span>آخر تعليقات وملاحظات العمل</span>
        </h3>
        <span className="text-[10px] font-bold text-slate-400">تحديث فوري</span>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex gap-4 p-4 rounded-2xl bg-slate-50 hover:bg-slate-100/80 dark:bg-slate-900/40 dark:hover:bg-slate-900/80 border border-slate-100/50 dark:border-slate-800/50 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>

            <div className="flex-1 space-y-1.5 min-w-0">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-relaxed break-words">
                {item.content}
              </p>
              
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold font-mono">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{formatRelativeTime(item.createdAt)}</span>
                  {item.requestSerialNumber && (
                    <span className="mr-2 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-black">
                      طلب: {item.requestSerialNumber}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onViewRequest(item.requestId)}
                  className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-0.5 transition-colors group-hover:underline cursor-pointer"
                >
                  <span>عرض الطلب</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}

        {items.length === 0 && (
          <div className="text-center py-10 bg-slate-50 dark:bg-slate-900/20 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            <MessageSquare className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
            <p className="text-xs font-bold text-slate-400">لا توجد ملاحظات أو تعليقات مضافة مؤخراً.</p>
          </div>
        )}
      </div>
    </div>
  );
}
