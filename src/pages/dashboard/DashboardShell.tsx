import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Navigate } from 'react-router-dom';
import EmployeeDashboard from './EmployeeDashboard';
import DashboardPage from '../DashboardPage'; // اللوحة العامة الحالية للمديرين والأدمن
import { Loader2, ShieldAlert } from 'lucide-react';

export default function DashboardShell() {
  const { user, profile, loading } = useAuth();

  // التحقق من حالة التحميل الأولية للمستخدم
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-6" dir="rtl">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
        <h3 className="text-lg font-black text-slate-700 dark:text-slate-300 mt-4">جاري فحص وتوجيه لوحة التحكم...</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">برجاء الانتظار قليلاً للتحقق من هوية الدخول الآمن.</p>
      </div>
    );
  }

  // إذا لم يكن مسجلاً، اذهب لصفحة تسجيل الدخول
  if (!user || !profile) {
    return <Navigate to="/login" replace />;
  }

  const role = profile.role || 'employee';

  // توجيه ذكي حسب دور المعرف للتطبيق
  switch (role) {
    case 'admin':
    case 'law_manager':
    case 'company_manager':
      // المدراء والمسؤولون الكبار يوجهون للوحة الشاملة الأكبر للتداول المالي والإدارة
      return <DashboardPage />;
    
    case 'employee':
    case 'law_assistant':
    case 'company_assistant':
      // المساعدين والموظفين ذوي الصلاحيات المحدودة يذهبون إلى اللوحة المحدودة الحامية للبيانات
      return <EmployeeDashboard />;
    
    default:
      // حالة دور غير معروف أو غير مصرح له
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 text-right" dir="rtl">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 rounded-3xl max-w-md w-full shadow-lg space-y-4">
            <div className="p-3 bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 rounded-2xl w-fit">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">وصول غير مصرح به</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              دور الموظف الحالي الخاص بك غير مسجل أو مفعل بالمستويات الأمنية الحالية للمؤسسة. يرجى التواصل مع المدير العام.
            </p>
          </div>
        </div>
      );
  }
}
