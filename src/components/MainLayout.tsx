import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../firebase/config';
import { signOut } from 'firebase/auth';
import { useAuth } from '../hooks/useAuth';
import { useSessionReminders } from '../hooks/useSessionReminders';
import Sidebar from './Layout/Sidebar';
import Header from './Layout/Header';
import Footer from './Layout/Footer';

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, isAdmin } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // تفعيل خطاف التذكيرات التلقائية
  useSessionReminders();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // ترجمة وتسمية العناوين التفاعلية للصفحات
  const pageTitle = {
    '/': 'لوحة التحكم الرئيسية',
    '/requests': 'طلبات الموكلين الجدد',
    '/cases': 'إدارة القضايا التنفيذية',
    '/users': 'إدارة شؤون الموظفين والصلاحيات',
    '/settings/execution': 'إعدادات التنفيذ والمواعيد',
    '/settings/notifications': 'إعدادات التنبيهات والربط الذكي',
    '/profile': 'الصفحة الشخصية'
  }[location.pathname] || (location.pathname.startsWith('/cases/') ? 'تفاصيل القضية القانونية والمالية' : 'النظام الداخلي للمنصة');

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-base" dir="rtl">
      {/* القائمة الجانبية المطورة بالكامل */}
      <Sidebar 
        isSidebarCollapsed={isSidebarCollapsed}
        isAdmin={!!isAdmin}
        profileEmail={profile?.email || 'موثق'}
        handleLogout={handleLogout}
      />

      {/* منطقة المحتوى الأساسي الفسيحة */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* رأس الصفحة العصري للتحكم بالملف والبحث */}
        <Header 
          isSidebarCollapsed={isSidebarCollapsed}
          setIsSidebarCollapsed={setIsSidebarCollapsed}
          pageTitle={pageTitle}
          userProfile={profile}
        />

        {/* عرض تفاصيل الصفحات الفرعية مع مباعدة كافية */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          <Outlet />
        </main>

        {/* مذيل الصفحة الاحترافي الحاضر بكل مكان */}
        <Footer />
      </div>
    </div>
  );
}
