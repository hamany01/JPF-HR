import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../firebase/config';
import { signOut } from 'firebase/auth';
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  LogOut, 
  ChevronRight, 
  FileText, 
  Bell,
  ChevronsLeft, 
  ChevronsRight 
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import NotificationsBell from './notifications/NotificationsBell';

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, isAdmin } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: FileText, label: 'Requests', path: '/requests' },
    { icon: FileText, label: 'Cases', path: '/cases' },
    { icon: Settings, label: 'Execution Settings', path: '/settings/execution', adminOnly: true },
    { icon: Bell, label: 'Notification Settings', path: '/settings/notifications', adminOnly: true },
    { icon: Users, label: 'Employees', path: '/users', adminOnly: true },
    { icon: Settings, label: 'Profile', path: '/profile' },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-base" dir="rtl">
      {/* Sidebar */}
      <aside className={cn(
        "bg-slate-900 flex flex-col border-l border-slate-800 hidden md:flex transition-all duration-300 ease-in-out",
        isSidebarCollapsed ? "w-20" : "w-64"
      )}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8 overflow-hidden">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold text-white text-xs shrink-0">JP</div>
            {!isSidebarCollapsed && (
              <h1 className="text-xl font-bold text-white tracking-tight truncate whitespace-nowrap">JPF-HR <span className="text-xs font-normal text-slate-400">الإصدار 1.0</span></h1>
            )}
          </div>

          <nav className="space-y-1">
            {menuItems.map((item) => {
              if (item.adminOnly && !isAdmin) return null;
              const isActive = location.pathname === item.path || (item.path === '/cases' && location.pathname.startsWith('/cases'));
              
              const translatedLabel = {
                'Dashboard': 'لوحة التحكم',
                'Requests': 'الطلبات',
                'Cases': 'القضايا',
                'Execution Settings': 'إعدادات التنفيذ',
                'Notification Settings': 'إعدادات الإشعارات',
                'Employees': 'الموظفون',
                'Profile': 'الملف الشخصي'
              }[item.label] || item.label;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  title={isSidebarCollapsed ? translatedLabel : ''}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-sm font-medium",
                    isActive 
                      ? "bg-indigo-600/10 text-indigo-400 shadow-sm" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800",
                    isSidebarCollapsed ? "justify-center px-2" : ""
                  )}
                >
                  <item.icon size={20} className={cn("shrink-0", isActive ? "text-indigo-400" : "text-slate-400")} />
                  {!isSidebarCollapsed && <span className="truncate whitespace-nowrap">{translatedLabel}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto p-6">
          {!isSidebarCollapsed && (
            <div className="bg-slate-800/50 rounded-xl p-4 mb-4 text-right">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-slate-300 font-medium uppercase tracking-wider">قاعدة البيانات متصلة</span>
              </div>
              <p className="text-[10px] text-slate-500 font-mono truncate">{profile?.email || 'موثق'}</p>
            </div>
          )}
          
          <button
            onClick={handleLogout}
            title="تسجيل الخروج"
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex-row-reverse",
              isSidebarCollapsed ? "justify-center px-2" : ""
            )}
          >
            <LogOut size={20} className="shrink-0" />
            {!isSidebarCollapsed && <span>تسجيل الخروج</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10 w-full">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors shrink-0"
              title={isSidebarCollapsed ? "فتح القائمة" : "طي القائمة"}
            >
              {isSidebarCollapsed ? <ChevronsRight size={20} /> : <ChevronsLeft size={20} />}
            </button>
            <div>
              <h2 className="text-sm text-slate-500">التطبيق النشط</h2>
              <p className="text-lg font-bold text-slate-800">
                {{
                  '/': 'لوحة التحكم',
                  '/users': 'إدارة الموظفين',
                  '/profile': 'الملف الشخصي'
                }[location.pathname] || 'النظام'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <NotificationsBell />
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-900">{profile?.name || 'مستخدم'}</p>
                <p className="text-xs text-slate-500 capitalize">
                  {{
                    'admin': 'مدير النظام',
                    'hr': 'الموارد البشرية',
                    'manager': 'مسؤول',
                    'employee': 'موظف'
                  }[profile?.role] || 'عضو'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-indigo-500 flex items-center justify-center overflow-hidden">
                <span className="text-sm font-bold text-slate-500">
                  {profile?.name?.charAt(0) || 'م'}
                </span>
              </div>
            </div>
          </div>
        </header>

        <div className="p-8 flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
