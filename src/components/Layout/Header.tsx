import React from 'react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import NotificationsBell from '../notifications/NotificationsBell';

interface HeaderProps {
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (value: boolean) => void;
  pageTitle: string;
  userProfile: {
    name?: string;
    role?: string;
  } | null;
}

export default function Header({ 
  isSidebarCollapsed, 
  setIsSidebarCollapsed, 
  pageTitle, 
  userProfile 
}: HeaderProps) {
  
  const roleTranslation = {
    'admin': 'مدير النظام',
    'hr': 'الموارد البشرية',
    'manager': 'مسؤول',
    'employee': 'موظف'
  }[userProfile?.role || ''] || 'عضو';

  return (
    <header className="h-20 bg-white border-b border-slate-200/80 flex items-center justify-between px-8 sticky top-0 z-10 w-full shadow-sm shadow-slate-100/30">
      {/* القسم الأيمن: زر طي القائمة والصفحة النشطة */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-all duration-200 shrink-0 cursor-pointer active:scale-95"
          title={isSidebarCollapsed ? "فتح القائمة" : "طي القائمة"}
          id="sidebar-toggle-btn"
        >
          {isSidebarCollapsed ? <ChevronsRight size={22} /> : <ChevronsLeft size={22} />}
        </button>
        
        {/* فاصل جمالي */}
        <div className="h-8 w-[1px] bg-slate-200"></div>

        <div>
          <h2 className="text-[11px] font-bold text-slate-400">الصفحة الفرعية</h2>
          <p className="text-base font-extrabold text-slate-800">
            {pageTitle}
          </p>
        </div>
      </div>

      {/* القسم الأيسر: الإشعارات والمباركة التعريقية باللوقو وهوية الموظف الموثق */}
      <div className="flex items-center gap-6">
        {/* جرس الإشعارات */}
        <div className="transition-transform hover:scale-105">
          <NotificationsBell />
        </div>

        {/* فاصل رأسي */}
        <div className="h-8 w-[1px] bg-slate-200"></div>

        {/* معلومات المستخدم مع ملمس عصري */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-slate-900 leading-tight">{userProfile?.name || 'مستخدم'}</p>
            <p className="text-[10px] font-bold text-indigo-600 bg-indigo-50/80 px-2 py-0.5 rounded-full mt-1 inline-block">
              {roleTranslation}
            </p>
          </div>
          
          <div className="w-10 h-10 rounded-full bg-indigo-50/60 border-2 border-indigo-500/80 flex items-center justify-center overflow-hidden shadow-inner transition-transform hover:rotate-6">
            <span className="text-sm font-extrabold text-indigo-700">
              {userProfile?.name?.charAt(0) || 'م'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
