import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  where 
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { AppEvent } from '../../types/events';
import { Bell, Clock, AlertCircle, CheckCircle2, History as HistoryIcon, ExternalLink, ChevronLeft, Scale, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';

export default function NotificationsBell() {
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(
      collection(db, 'appEvents'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AppEvent[];
      setEvents(docs);
      
      // For now, let's just use local storage or memory to track "seen" notifications
      // In a real app, this would be in Firestore per user
      const lastSeen = localStorage.getItem('last_seen_event_time') || '0';
      const unread = docs.filter(e => {
        const time = (e.createdAt && 'toMillis' in e.createdAt) ? e.createdAt.toMillis() : 0;
        return time > parseInt(lastSeen);
      }).length;
      setUnreadCount(unread);
    });

    return () => unsubscribe();
  }, []);

  const togglePanel = () => {
    setIsOpen(!isOpen);
    if (!isOpen && events.length > 0) {
      const latestTime = (events[0].createdAt && 'toMillis' in events[0].createdAt) ? events[0].createdAt.toMillis() : 0;
      localStorage.setItem('last_seen_event_time', latestTime.toString());
      setUnreadCount(0);
      window.dispatchEvent(new Event('on-last-seen-updated'));
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'request_created': return <AlertCircle className="text-amber-500" size={16} />;
      case 'request_rejected': return <HistoryIcon className="text-red-500" size={16} />;
      case 'request_reactivated': return <Clock className="text-indigo-500" size={16} />;
      case 'request_approved_preliminary': return <CheckCircle2 className="text-blue-500" size={16} />;
      case 'request_converted_to_case': return <Scale className="text-green-500" size={16} />;
      case 'case_created': return <Scale className="text-indigo-600" size={16} />;
      case 'payment_added': return <CreditCard className="text-emerald-500" size={16} />;
      case 'case_paid_off': return <CheckCircle2 className="text-emerald-600" size={16} />;
      case 'case_status_changed': return <Clock className="text-blue-400" size={16} />;
      default: return <Bell size={16} />;
    }
  };

  const formatRelativeTime = (timestamp: any) => {
    if (!timestamp) return '';
    const now = new Date();
    const date = timestamp.toDate();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'الآن';
    if (diffInSeconds < 3600) return `منذ ${Math.floor(diffInSeconds / 60)} دقيقة`;
    if (diffInSeconds < 86400) return `منذ ${Math.floor(diffInSeconds / 3600)} ساعة`;
    return date.toLocaleDateString('ar-SA');
  };

  const handleEventClick = (event: AppEvent) => {
    setIsOpen(false);
    
    if (event.category === 'case' && event.caseId) {
      navigate(`/cases/${event.caseId}`);
    } else if (event.category === 'request' && event.requestId) {
      if (event.type === 'request_converted_to_case' && event.payload?.caseId) {
        navigate(`/cases/${event.payload.caseId}`);
      } else {
        navigate('/requests');
      }
    } else {
      navigate('/requests');
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={togglePanel}
        className={cn(
          "p-2.5 rounded-xl transition-all relative group",
          isOpen ? "bg-indigo-50 text-indigo-600" : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
        )}
      >
        <Bell size={22} />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 w-4 h-4 bg-red-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white shadow-sm animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40 bg-transparent"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="absolute left-0 mt-3 w-80 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 overflow-hidden"
              dir="rtl"
            >
              <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-sm font-black text-slate-700 flex items-center gap-2">
                  <Bell size={16} />
                  <span>الإشعارات الأخيرة</span>
                </h3>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-2 py-0.5 rounded-lg border border-slate-100">
                  {events.length} إشعار
                </span>
              </div>

              <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                {events.length === 0 ? (
                  <div className="p-10 text-center flex flex-col items-center gap-3">
                    <div className="w-12 h-12 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center">
                      <Bell size={24} />
                    </div>
                    <p className="text-xs font-bold text-slate-400">لا توجد إشعارات حالياً</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {events.map((event) => (
                      <button 
                        key={event.id}
                        onClick={() => handleEventClick(event)}
                        className="w-full p-4 text-right hover:bg-slate-50 transition-colors flex gap-3 group"
                      >
                        <div className="mt-1 w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center shrink-0 shadow-sm group-hover:scale-110 transition-all">
                          {getEventIcon(event.type)}
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className="text-xs font-bold text-slate-700 leading-relaxed text-right line-clamp-2">
                            {event.message}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                              <Bell size={10} />
                              {formatRelativeTime(event.createdAt)}
                            </span>
                            <div className="flex items-center gap-1 text-[10px] font-black text-indigo-500 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                               <span>فتح</span>
                               <ChevronLeft size={10} />
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
                 <button 
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/requests');
                  }}
                  className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-[0.2em] transition-colors"
                >
                  عرض جميع الطلبات
                 </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
