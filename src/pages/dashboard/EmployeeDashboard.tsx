import React, { useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useEmployeeRequests } from '../../hooks/useEmployeeRequests';
import { useEmployeeNotes } from '../../hooks/useEmployeeNotes';
import { usePermissions } from '../../hooks/usePermissions';
import StatCard from '../../components/dashboard/StatCard';
import RequestsTable from '../../components/dashboard/RequestsTable';
import RecentActivity from '../../components/dashboard/RecentActivity';
import StatusPieChart from '../../components/dashboard/charts/StatusPieChart';
import CompletionLineChart from '../../components/dashboard/charts/CompletionLineChart';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  TrendingUp, 
  Loader2, 
  LayoutDashboard, 
  MessageSquare, 
  PieChart as PieIcon, 
  CircleDollarSign,
  UserCheck
} from 'lucide-react';

export default function EmployeeDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { requests, loading: requestsLoading } = useEmployeeRequests();
  const { notes, loading: notesLoading } = useEmployeeNotes();
  const { getFieldVisibility } = usePermissions();

  // فحص أذونات الحقل المالي لقيمة العرض
  const financialVisibility = getFieldVisibility('financialAmounts');

  // حساب الإحصائيات العامة للموظف
  const stats = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter((r) => r.status === 'pending').length;
    const completed = requests.filter((r) => ['approved', 'converted_to_case'].includes(r.status)).length;
    const approvedPre = requests.filter((r) => r.status === 'approved_preliminary').length;

    // إجمالي المبالغ المالية فقط في حال سُمح برؤيتها
    let totalFinancialAmount = 0;
    if (financialVisibility !== 'hidden') {
      totalFinancialAmount = requests.reduce((sum, r) => sum + (r.claimAmount || 0), 0);
    }

    return {
      total,
      pending,
      completed,
      approvedPre,
      totalFinancialAmount,
    };
  }, [requests, financialVisibility]);

  // تجهيز بيانات المخطط الدائري (Pie Chart) حسب حالة طلبات الموظف
  const pieChartData = useMemo(() => {
    const counts = {
      pending: requests.filter((r) => r.status === 'pending').length,
      approved_preliminary: requests.filter((r) => r.status === 'approved_preliminary').length,
      completed: requests.filter((r) => ['approved', 'converted_to_case'].includes(r.status)).length,
      rejected: requests.filter((r) => r.status === 'rejected').length,
    };

    return [
      { name: 'قيد المراجعة', value: counts.pending, color: '#facc15' }, // Amber
      { name: 'موافقة مبدئية', value: counts.approved_preliminary, color: '#10b981' }, // Emerald
      { name: 'مكتملة / محولة', value: counts.completed, color: '#3b82f6' }, // Blue
      { name: 'مرفوضة', value: counts.rejected, color: '#f43f5e' }, // Rose
    ].filter((item) => item.value > 0); // تصفية الحالات الخالية لعرض أفضل
  }, [requests]);

  // حساب معدل المعاملات المكتملة عبر الأيام السبعة الأخيرة للمخطط الخطي (Line Chart)
  const lineChartData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d;
    }).reverse();

    return last7Days.map((date) => {
      const dateString = date.toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'numeric' });
      const completedOnThisDay = requests.filter((r) => {
        if (!['approved', 'converted_to_case'].includes(r.status)) return false;
        
        let reqDate: Date;
        if (r.updatedAt && typeof r.updatedAt.toDate === 'function') {
          reqDate = r.updatedAt.toDate();
        } else if (r.createdAt && typeof r.createdAt.toDate === 'function') {
          reqDate = r.createdAt.toDate();
        } else {
          reqDate = new Date(r.updatedAt || r.createdAt);
        }

        return (
          reqDate.getDate() === date.getDate() &&
          reqDate.getMonth() === date.getMonth() &&
          reqDate.getFullYear() === date.getFullYear()
        );
      }).length;

      return {
        date: dateString,
        count: completedOnThisDay,
      };
    });
  }, [requests]);

  const formatCurrency = (val: number) => {
    return val.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 });
  };

  const handleViewDetails = (id: string) => {
    navigate(`/employee/requests/${id}`);
  };

  if (requestsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center" dir="rtl">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        <h3 className="text-base font-black text-slate-700 dark:text-slate-300 mt-4">جاري تحميل لوحة الموظف المعززة...</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">برجاء الانتظار لتحميل الفرز والنشاط الآمن.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 text-right" dir="rtl">
      {/* الترحيب والمسمى الوظيفي */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              لوحة المتابعة الشخصية
            </h1>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-bold">
            مرحباً بك مجدداً، <span className="text-indigo-600 dark:text-indigo-400 font-bold">{profile?.name || 'الموظف'}</span> (دور: موظف بامتيازات محددة).
          </p>
        </div>
        
        <div className="flex gap-2.5">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 px-4 py-2 rounded-xl text-xs font-black text-slate-600 dark:text-slate-400 border border-slate-200/40">
            <UserCheck className="w-4 h-4 text-emerald-500 animate-pulse" />
            <span>الصلاحيات: نشطة ومعالجة</span>
          </div>
        </div>
      </div>

      {/* الـ StatCards الإحصائية */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="معاملاتي الإجمالية"
          value={stats.total}
          icon={<FileText className="w-5 h-5" />}
          color="indigo"
          trend={{ value: 10, type: 'increase', label: 'الشهر الحالي' }}
        />
        
        <StatCard
          title="قيد المراجعة حالياً"
          value={stats.pending}
          icon={<Clock className="w-5 h-5" />}
          color="amber"
        />

        <StatCard
          title="موافقة مبدئية"
          value={stats.approvedPre}
          icon={<CheckCircle className="w-5 h-5 text-emerald-300" />}
          color="emerald"
        />

        {financialVisibility !== 'hidden' ? (
          <StatCard
            title="إجمالي المطالبات النشطة"
            value={financialVisibility === 'masked' ? '***,*** ر.س' : formatCurrency(stats.totalFinancialAmount)}
            icon={<CircleDollarSign className="w-5 h-5" />}
            color="emerald"
          />
        ) : (
          <div className="p-6 rounded-3xl border border-rose-100/50 dark:border-rose-950/20 bg-rose-50/20 dark:bg-rose-950/5 flex flex-col justify-center items-center text-center space-y-2">
            <CircleDollarSign className="w-8 h-8 text-rose-300 dark:text-rose-800" />
            <p className="text-xs font-black text-rose-850 dark:text-rose-450">معلومات مالية محجوبة</p>
            <span className="text-[10px] text-slate-400 leading-tight">حسب إعدادات الخصوصية الخاصة بالدور</span>
          </div>
        )}
      </div>

      {/* الرسوم البيانية (Charts Row) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* مخطط خطي لتقدم العمليات */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-6">
          <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              <span>معدل المعاملات المكتملة (آخر 7 أيام)</span>
            </h3>
            <span className="text-[10px] font-black text-slate-400">تحليل تراكمي اليوم</span>
          </div>
          
          <div className="h-[240px] w-full">
            <CompletionLineChart data={lineChartData} />
          </div>
        </div>

        {/* مخطط دائري لتوزيع الحالات */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-6">
          <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <PieIcon className="w-5 h-5 text-blue-500" />
              <span>فئات المعاملات وحالاتها</span>
            </h3>
          </div>
          
          <div className="h-[240px] w-full">
            <StatusPieChart data={pieChartData} totalCount={stats.total} />
          </div>
        </div>
      </div>

      {/* جدول المعاملات وآخر الملاحظات */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* جدول الطلبات */}
        <div className="xl:col-span-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-200">📋 الطلبات والمعاملات المسندة إليّ</h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">قائمة الطلبات الموجهة لحسابك حالياً للمراجعة والتحويل القانوني.</p>
            </div>
          </div>
          
          <RequestsTable requests={requests} onView={handleViewDetails} />
        </div>

        {/* آخر الملاحظات */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <RecentActivity items={notes} onViewRequest={handleViewDetails} />
        </div>
      </div>
    </div>
  );
}
