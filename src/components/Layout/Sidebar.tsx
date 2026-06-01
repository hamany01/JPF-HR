import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  LogOut, 
  FileText, 
  Bell,
  Shield,
  Info
} from 'lucide-react';
import { cn } from '../../lib/utils';
import JpfLogo from './JpfLogo';
import { APP_VERSION } from '../../config/version';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';

interface SidebarProps {
  isSidebarCollapsed: boolean;
  isAdmin: boolean;
  profileEmail?: string;
  handleLogout: () => void;
}

export default function Sidebar({ 
  isSidebarCollapsed, 
  isAdmin, 
  profileEmail, 
  handleLogout 
}: SidebarProps) {
  const location = useLocation();
  const { user } = useAuth();

  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);
  const [activeCasesCount, setActiveCasesCount] = useState<number>(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);

  useEffect(() => {
    if (!user?.uid) return;

    // 1. Listen to requests: count pending requests
    const qRequests = query(collection(db, 'requests'));
    const unsubscribeRequests = onSnapshot(qRequests, (snapshot) => {
      const docs = snapshot.docs.map(doc => doc.data());
      const pending = docs.filter((item: any) => {
        const isPending = item.status === 'pending';
        if (!isPending) return false;
        if (isAdmin) return true;
        return item.assignedEmployeeId === user.uid;
      });
      setPendingRequestsCount(pending.length);
    }, (error) => {
      console.error("Error listening to requests for sidebar badges:", error);
    });

    // 2. Listen to cases: count active cases
    const qCases = query(collection(db, 'cases'));
    const unsubscribeCases = onSnapshot(qCases, (snapshot) => {
      const docs = snapshot.docs.map(doc => doc.data());
      const active = docs.filter((item: any) => {
        return item.status !== 'closed' && item.status !== 'archived';
      });
      setActiveCasesCount(active.length);
    }, (error) => {
      console.error("Error listening to cases for sidebar badges:", error);
    });

    // 3. Listen to appEvents for unread notifications count
    const fetchUnreadNotifications = () => {
      const qEvents = query(collection(db, 'appEvents'));
      const unsubscribeEvents = onSnapshot(qEvents, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const lastSeen = localStorage.getItem('last_seen_event_time') || '0';
        const unread = docs.filter((e: any) => {
          const time = (e.createdAt && 'toMillis' in e.createdAt) ? e.createdAt.toMillis() : 0;
          return time > parseInt(lastSeen);
        }).length;
        setUnreadNotificationsCount(unread);
      }, (error) => {
        console.error("Error listening to appEvents for sidebar badges:", error);
      });
      return unsubscribeEvents;
    };

    let unsubscribeEvents = fetchUnreadNotifications();

    // Listen to custom updates from NotificationsBell to immediately refresh count
    const handleEventsRead = () => {
      setUnreadNotificationsCount(0);
    };

    window.addEventListener('on-last-seen-updated', handleEventsRead);

    return () => {
      unsubscribeRequests();
      unsubscribeCases();
      unsubscribeEvents();
      window.removeEventListener('on-last-seen-updated', handleEventsRead);
    };
  }, [user?.uid, isAdmin]);

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: FileText, label: 'Requests', path: '/requests' },
    { icon: FileText, label: 'Cases', path: '/cases' },
    { icon: Settings, label: 'Execution Settings', path: '/settings/execution', adminOnly: true },
    { icon: Bell, label: 'Notification Settings', path: '/settings/notifications', adminOnly: true },
    { icon: Shield, label: 'Permissions Settings', path: '/admin/permissions', adminOnly: true },
    { icon: Users, label: 'Employees', path: '/users', adminOnly: true },
    { icon: Info, label: 'About', path: '/about', adminOnly: true },
    { icon: Settings, label: 'Profile', path: '/profile' },
  ];

  const getBadgeValue = (path: string) => {
    if (path === '/requests') return pendingRequestsCount;
    if (path === '/cases') return activeCasesCount;
    if (path === '/settings/notifications') return unreadNotificationsCount;
    return 0;
  };

  const getBadgeColor = (path: string) => {
    if (path === '/requests') return 'bg-amber-500 text-white';
    if (path === '/cases') return 'bg-sky-500 text-white';
    if (path === '/settings/notifications') return 'bg-rose-500 text-white';
    return 'bg-indigo-500 text-white';
  };

  const translatedLabel = (label: string) => {
    return {
      'Dashboard': 'لوحة التحكم',
      'Requests': 'الطلبات والعملاء',
      'Cases': 'إدارة القضايا',
      'Execution Settings': 'إعدادات التنفيذ',
      'Notification Settings': 'إعدادات الإشعارات',
      'Permissions Settings': 'صلاحيات الأدوار',
      'Employees': 'إدارة الموظفين',
      'About': 'حول النظام',
      'Profile': 'الملف الشخصي'
    }[label] || label;
  };

  return (
    <aside className={cn(
      "bg-slate-900 flex flex-col border-l border-slate-800 hidden md:flex transition-all duration-300 ease-in-out shrink-0",
      isSidebarCollapsed ? "w-20" : "w-68"
    )}>
      {/* قسم اللوقو والهوية التجارية */}
      <div className="p-6 border-b border-slate-800/60">
        <div className="flex flex-col items-center gap-3">
          <JpfLogo className={cn("transition-all duration-300", isSidebarCollapsed ? "h-6" : "h-16 max-h-16 object-contain")} />
          {!isSidebarCollapsed && (
            <div className="text-center mt-1 animate-fadeIn">
              <h1 className="text-sm font-black text-white tracking-wide bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">نظام الشؤون القانونية</h1>
              <span className="text-[10px] font-bold text-slate-400 block mt-1 leading-relaxed">شركة مصنع جدة للدهانات و المعاجيين</span>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-800/60 px-2 py-0.5 rounded-full mt-2 inline-block">الإصدار v{APP_VERSION.full}</span>
            </div>
          )}
        </div>
      </div>

      {/* روابط الإبحار والتنقل */}
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        {menuItems.map((item) => {
          if (item.adminOnly && !isAdmin) return null;
          const isActive = 
            location.pathname === item.path || 
            (item.path === '/' && location.pathname === '/dashboard') || 
            (item.path === '/cases' && location.pathname.startsWith('/cases'));
          const labelText = translatedLabel(item.label);
          const badgeValue = getBadgeValue(item.path);
          const badgeColor = getBadgeColor(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              title={isSidebarCollapsed ? labelText : ''}
              className={cn(
                "flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 text-sm font-bold group relative",
                isActive 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/40" 
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/80",
                isSidebarCollapsed ? "justify-center px-2" : ""
              )}
            >
              <item.icon size={20} className={cn("shrink-0 transition-transform duration-300 group-hover:scale-110", isActive ? "text-white" : "text-slate-400 group-hover:text-indigo-400")} />
              
              {!isSidebarCollapsed && (
                <span className="truncate whitespace-nowrap flex-1 text-right">{labelText}</span>
              )}

              {/* Badge for Expanded Sidebar */}
              {!isSidebarCollapsed && badgeValue > 0 && (
                <span className={cn(
                  "text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 shadow-sm transition-all duration-300 group-hover:scale-105",
                  badgeColor
                )}>
                  {badgeValue}
                </span>
              )}

              {/* Badge for Collapsed Sidebar */}
              {isSidebarCollapsed && badgeValue > 0 && (
                <span className={cn(
                  "absolute top-2 left-6 min-w-4 h-4 text-[9px] font-black flex items-center justify-center rounded-full px-1 border border-slate-900 shadow-md",
                  badgeColor
                )}>
                  {badgeValue > 99 ? '99+' : badgeValue}
                </span>
              )}

              {isActive && !isSidebarCollapsed && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-400 rounded-l-full"></div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* الحالة السفلية وتسجيل الخروج */}
      <div className="p-4 border-t border-slate-800/60 bg-slate-950/40 space-y-3">
        {!isSidebarCollapsed && (
          <div className="bg-slate-800/40 rounded-xl p-3 text-right border border-slate-800/50">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></div>
              <span className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-wider">قاعدة البيانات متصلة</span>
            </div>
            <p className="text-[10px] text-slate-500 font-mono truncate">{profileEmail}</p>
          </div>
        )}
        
        {/* نظام ترقيم الإصدارات في أسفل Sidebar */}
        <div className="text-[10px] text-slate-500 text-center select-none font-mono font-bold pt-1 border-t border-slate-800/40">
          <span className="hover:text-indigo-400 transition-colors">JPF-HR v{APP_VERSION.full}</span>
          {!isSidebarCollapsed && <span className="block text-[9px] opacity-75 mt-0.5">{APP_VERSION.lastUpdated}</span>}
        </div>
        
        <button
          onClick={handleLogout}
          title="تسجيل الخروج"
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3.5 text-sm font-bold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 rounded-xl transition-all duration-300 cursor-pointer",
            isSidebarCollapsed ? "justify-center px-2" : ""
          )}
        >
          <LogOut size={20} className="shrink-0" />
          {!isSidebarCollapsed && <span>تسجيل الخروج</span>}
        </button>
      </div>
    </aside>
  );
}
