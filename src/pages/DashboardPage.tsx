import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  where,
  Timestamp,
  getDocs
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  FileText, 
  Scale, 
  TrendingUp, 
  DollarSign, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight,
  ChevronLeft,
  Bell,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  PieChart as PieChartIcon,
  Activity as ActivityIcon,
  History as HistoryIcon
} from 'lucide-react';
import { cn } from '../lib/utils';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from 'recharts';
import { format, subMonths, isAfter, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns';
import { arSA } from 'date-fns/locale';

interface DashboardStats {
  activeRequests: number;
  inProgressCases: number;
  totalClaimAmount: number;
  totalReceivedAmount: number;
  collectionRate: number;
  delayedRequestsCount: number;
  avgConversionTime: number;
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  const [requests, setRequests] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Real-time data fetching
  useEffect(() => {
    setLoading(true);

    const fetchAllUsers = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'users'));
        const usersMap: Record<string, string> = {};
        snapshot.docs.forEach(doc => {
          usersMap[doc.id] = doc.data().name || 'مستخدم';
        });
        setAllUsers(usersMap);
      } catch (err) {
        console.error("Error fetching users:", err);
      }
    };
    
    fetchAllUsers();
    
    // Listen to requests
    const qRequests = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
    const unsubscribeRequests = onSnapshot(qRequests, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Listen to cases
    const qCases = query(collection(db, 'cases'), orderBy('createdAt', 'desc'));
    const unsubscribeCases = onSnapshot(qCases, (snapshot) => {
      setCases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Listen to recent events
    const qEvents = query(
      collection(db, 'appEvents'), 
      orderBy('createdAt', 'desc'), 
      limit(5)
    );
    const unsubscribeEvents = onSnapshot(qEvents, (snapshot) => {
      setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    setLoading(false);
    return () => {
      unsubscribeRequests();
      unsubscribeCases();
      unsubscribeEvents();
    };
  }, []);

  // Compute Stats
  const activeRequests = requests.filter(r => ['pending', 'approved_preliminary'].includes(r.status));
  const inProgressCases = cases.filter(c => c.status === 'in_progress');
  const totalClaimAmount = cases.reduce((acc, c) => acc + (c.claimAmount || 0), 0);
  const totalReceivedAmount = cases.reduce((acc, c) => acc + (c.receivedAmount || 0), 0);
  const collectionRate = totalClaimAmount > 0 ? (totalReceivedAmount / totalClaimAmount) * 100 : 0;
  
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const delayedRequests = activeRequests.filter(r => {
    const createdAt = (r.createdAt && 'toDate' in r.createdAt) ? r.createdAt.toDate() : null;
    return createdAt && createdAt < sevenDaysAgo;
  });

  const convertedRequests = requests.filter(r => r.status === 'converted_to_case' && r.convertedAt && r.createdAt);
  const avgConversionTime = convertedRequests.length > 0 
    ? convertedRequests.reduce((acc, r) => {
        const convMillis = (r.convertedAt && 'toMillis' in r.convertedAt) ? r.convertedAt.toMillis() : 0;
        const createMillis = (r.createdAt && 'toMillis' in r.createdAt) ? r.createdAt.toMillis() : 0;
        const diff = (convMillis - createMillis) / (1000 * 60 * 60 * 24);
        return acc + diff;
      }, 0) / convertedRequests.length 
    : 0;

  // Prepare Trends Data (Last 6 months)
  const last6Months = eachMonthOfInterval({
    start: startOfMonth(subMonths(new Date(), 5)),
    end: endOfMonth(new Date())
  });

  const trendsData = last6Months.map(month => {
    const monthStr = format(month, 'MMM yyyy', { locale: arSA });
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);

    const createdInMonth = requests.filter(r => {
      const date = r.createdAt?.toDate();
      return date && date >= monthStart && date <= monthEnd;
    }).length;

    const convertedInMonth = requests.filter(r => {
      const date = r.convertedAt?.toDate();
      return date && date >= monthStart && date <= monthEnd;
    }).length;

    return { name: monthStr, requests: createdInMonth, cases: convertedInMonth };
  });

  // Distribution Data
  const distributionData = [
    { name: 'مفتوحة', value: cases.filter(c => c.status === 'open').length, color: '#facc15' },
    { name: 'قيد التنفيذ', value: cases.filter(c => c.status === 'in_progress').length, color: '#4f46e5' },
    { name: 'منتهية', value: cases.filter(c => c.status === 'closed').length, color: '#22c55e' },
  ];

  // Top 5 cases by remaining amount
  const topCases = [...cases]
    .map(c => ({
      ...c,
      remainingAmount: (c.claimAmount || 0) - (c.receivedAmount || 0)
    }))
    .sort((a, b) => b.remainingAmount - a.remainingAmount)
    .slice(0, 5);

  const formatCurrency = (val: number) => {
    return val.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 });
  };

  const KPICard = ({ title, value, subValue, icon: Icon, color, trend, sparkData }: any) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-3 rounded-2xl text-white shadow-lg", color)}>
          <Icon size={24} />
        </div>
        <div className="text-right">
          <p className="text-slate-500 text-xs font-black uppercase tracking-widest">{title}</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{value}</p>
        </div>
      </div>
      
      <div className="flex items-center justify-between mt-6">
        <div className="space-y-1">
           {subValue && <p className="text-[10px] font-bold text-slate-400">{subValue}</p>}
           {trend && (
             <div className={cn("flex items-center gap-1 text-[10px] font-bold", trend > 0 ? "text-green-600" : "text-red-600")}>
                {trend > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                <span>{Math.abs(trend)}% عن الشهر الماضي</span>
             </div>
           )}
        </div>
        <div className="w-20 h-10">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData}>
              <Line type="monotone" dataKey="value" stroke={trend > 0 ? "#10b981" : "#f43f5e"} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="space-y-8 pb-10" dir="rtl">
      {/* Header with quick greeting */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-3xl font-black text-slate-900 tracking-tight">نظرة عامة</h1>
           <p className="text-slate-400 font-bold mt-1 text-sm">مرحباً {profile?.name}، إليك ملخص العمليات اليوم.</p>
        </div>
        <div className="flex gap-2">
           <button onClick={() => navigate('/requests')} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-xl shadow-slate-200 flex items-center gap-2 hover:bg-slate-800 transition-all">
             <FileText size={18} />
             <span>الطلبات</span>
           </button>
           <button onClick={() => navigate('/cases')} className="bg-white text-slate-900 border border-slate-200 px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm flex items-center gap-2 hover:bg-slate-50 transition-all">
             <Scale size={18} />
             <span>القضايا</span>
           </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
          title="الطلبات النشطة" 
          value={activeRequests.length} 
          icon={Clock} 
          color="bg-indigo-500" 
          trend={12}
          sparkData={[{value: 10}, {value: 15}, {value: 12}, {value: 20}, {value: activeRequests.length}]}
        />
        <KPICard 
          title="القضايا قيد التنفيذ" 
          value={inProgressCases.length} 
          icon={ActivityIcon} 
          color="bg-blue-600" 
          trend={-5}
          sparkData={[{value: 5}, {value: 8}, {value: 7}, {value: 6}, {value: inProgressCases.length}]}
        />
        <KPICard 
          title="إجمالي المبالغ المطلوبة" 
          value={formatCurrency(totalClaimAmount)} 
          subValue="لكافة القضايا النشطة"
          icon={DollarSign} 
          color="bg-emerald-500" 
          trend={8}
          sparkData={[{value: 100}, {value: 120}, {value: 110}, {value: 140}, {value: totalClaimAmount / 10000}]}
        />
        <KPICard 
          title="المبالغ المحصلة" 
          value={formatCurrency(totalReceivedAmount)} 
          subValue={`نسبة التحصيل: ${collectionRate.toFixed(1)}%`}
          icon={TrendingUp} 
          color="bg-amber-500" 
          trend={15}
          sparkData={[{value: 50}, {value: 60}, {value: 55}, {value: 80}, {value: totalReceivedAmount / 10000}]}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-3xl p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
               <TrendingUp size={18} className="text-indigo-500" />
               <span>اتجاه الطلبات والقضايا</span>
            </h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-indigo-500" />
                <span className="text-[10px] font-bold text-slate-400">الطلبات</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-bold text-slate-400">القضايا</span>
              </div>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendsData}>
                <defs>
                  <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCases" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 700}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 700}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="requests" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRequests)" />
                <Area type="monotone" dataKey="cases" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorCases)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm flex flex-col justify-between">
          <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2 mb-8">
             <PieChartIcon size={18} className="text-blue-500" />
             <span>توزيع القضايا حسب الحالة</span>
          </h3>
          <div className="h-[240px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
               <span className="text-3xl font-black text-slate-900">{cases.length}</span>
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">إجمالي القضايا</span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 mt-4">
             {distributionData.map((item, i) => (
               <div key={i} className="flex items-center justify-between text-xs p-2 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="font-bold text-slate-600">{item.name}</span>
                  </div>
                  <span className="font-black text-slate-900">{item.value}</span>
               </div>
             ))}
          </div>
        </div>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Cases Table */}
        <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm flex flex-col">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
              <DollarSign size={18} className="text-emerald-500" />
              <span>أكبر 5 قضايا (مبالغ متبقية)</span>
            </h3>
            <button onClick={() => navigate('/cases')} className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 transition-colors">عرض الكل</button>
          </div>
          <div className="flex-1">
             <table className="w-full text-right border-collapse">
               <thead>
                 <tr className="bg-slate-50/30">
                   <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">المنفذ ضده</th>
                   <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">المبلغ المتبقي</th>
                   <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">الإجراء</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                 {topCases.map((c) => (
                   <tr key={c.id} className="hover:bg-slate-50/50 transition-colors group">
                     <td className="px-6 py-4">
                        <div className="flex flex-col">
                           <span className="text-xs font-black text-slate-700">{c.defendantName}</span>
                           <span className="text-[10px] text-slate-400 font-mono mt-0.5">{c.requestSerialNumber}</span>
                        </div>
                     </td>
                     <td className="px-6 py-4">
                        <span className="text-sm font-black text-emerald-600 font-mono">{formatCurrency(c.remainingAmount)}</span>
                     </td>
                     <td className="px-6 py-4">
                        <button 
                          onClick={() => navigate(`/cases/${c.id}`)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-100 transition-all shadow-none hover:shadow-sm"
                        >
                          <ChevronLeft size={16} />
                        </button>
                     </td>
                   </tr>
                 ))}
                 {topCases.length === 0 && (
                   <tr>
                     <td colSpan={3} className="px-6 py-10 text-center text-xs font-bold text-slate-400">لا توجد قضايا حالياً</td>
                   </tr>
                 )}
               </tbody>
             </table>
          </div>
        </div>

        {/* Recent Events List */}
        <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm flex flex-col">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
              <Bell size={18} className="text-amber-500" />
              <span>آخر الأحداث</span>
            </h3>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-2 py-0.5 rounded-lg border border-slate-100">تحديث لحظي</span>
          </div>
          <div className="flex-1 divide-y divide-slate-50">
            {events.map((event) => (
              <div key={event.id} className="p-4 flex gap-4 hover:bg-slate-50/50 transition-colors group">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center shrink-0 shadow-sm group-hover:scale-110 transition-transform">
                   {(event.type === 'request_created' || event.type === 'request_approved_preliminary') && <CheckCircle2 className="text-green-500" size={18} />}
                   {event.type === 'request_rejected' && <AlertTriangle className="text-red-500" size={18} />}
                   {event.type === 'request_reactivated' && <Clock className="text-indigo-500" size={18} />}
                   {(event.type === 'request_converted_to_case' || event.type === 'case_created') && <Scale className="text-blue-500" size={18} />}
                   {event.type === 'payment_added' && <CreditCard className="text-emerald-500" size={18} />}
                   {event.type === 'case_paid_off' && <CheckCircle2 className="text-emerald-600" size={18} />}
                   {event.type === 'case_status_changed' && <Clock className="text-blue-400" size={18} />}
                </div>
                <div className="flex-1 space-y-1">
                   <p className="text-xs font-bold text-slate-700 leading-relaxed">{event.message}</p>
                   <p className="text-[10px] font-black text-slate-400 font-mono italic">بواسطة: {event.createdByName || allUsers[event.createdBy] || '...'}</p>
                   <div className="flex items-center justify-between">
                     <span className="text-[10px] text-slate-400 font-mono italic">
                        {event.createdAt && typeof event.createdAt.toDate === 'function' ? event.createdAt.toDate().toLocaleString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '...'}
                     </span>
                     <button 
                      onClick={() => {
                        if (event.category === 'case' && event.caseId) navigate(`/cases/${event.caseId}`);
                        else if (event.category === 'request' && event.type === 'request_converted_to_case' && event.payload?.caseId) navigate(`/cases/${event.payload.caseId}`);
                        else navigate('/requests');
                      }}
                      className="text-[10px] font-black text-indigo-500 hover:underline flex items-center gap-1"
                     >
                       عرض <ChevronLeft size={10} />
                     </button>
                   </div>
                </div>
              </div>
            ))}
            {events.length === 0 && (
              <div className="p-10 text-center text-xs font-bold text-slate-400">لا توجد أحداث مؤخراً</div>
            )}
          </div>
        </div>
      </div>

      {/* Analytical Indicators Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Collection Rate Progress */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
           <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">معدل التحصيل الإجمالي</span>
              <span className="text-lg font-black text-emerald-600">{collectionRate.toFixed(1)}%</span>
           </div>
           <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
             <motion.div 
               initial={{ width: 0 }}
               animate={{ width: `${collectionRate}%` }}
               transition={{ duration: 1 }}
               className="h-full bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.3)]"
             />
           </div>
           <p className="text-[10px] font-bold text-slate-400 text-center">تم تحصيل {formatCurrency(totalReceivedAmount)} من إجمالي {formatCurrency(totalClaimAmount)}</p>
        </div>

        {/* Avg Conversion Time */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
           <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">متوسط وقت التحويل</span>
              <span className="text-lg font-black text-indigo-600 italic">يوم {avgConversionTime.toFixed(1)}</span>
           </div>
           <div className="flex items-center gap-3">
              <div className="flex -space-x-2 rtl:space-x-reverse">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center">
                    <Clock size={14} className="text-slate-400" />
                  </div>
                ))}
              </div>
              <p className="text-[10px] font-bold text-slate-400 leading-tight">بناءً على {convertedRequests.length} طلب تم تحويلهم بنجاح</p>
           </div>
        </div>

        {/* Delayed Requests */}
        <div className={cn(
          "bg-white border rounded-3xl p-6 shadow-sm space-y-4 transition-all",
          delayedRequests.length > 0 ? "border-red-100 shadow-red-50/50" : "border-slate-100"
        )}>
           <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">الطلبات المتأخرة</span>
              <span className={cn(
                "text-2xl font-black",
                delayedRequests.length > 0 ? "text-red-600" : "text-slate-900"
              )}>{delayedRequests.length}</span>
           </div>
           <div className="flex items-center gap-2">
              {delayedRequests.length > 0 ? (
                <div className="flex items-center gap-2 bg-red-50 text-red-600 px-3 py-1.5 rounded-xl border border-red-100 w-full animate-pulse">
                  <AlertTriangle size={14} />
                  <span className="text-[10px] font-black">تحتاج مراجعة عاجلة (أكثر من 7 أيام)</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-green-50 text-green-600 px-3 py-1.5 rounded-xl border border-green-100 w-full">
                  <CheckCircle2 size={14} />
                  <span className="text-[10px] font-black">كافة الطلبات قيد المعالجة النشطة</span>
                </div>
              )}
           </div>
        </div>
      </div>

      {/* Smart News Section */}
      <div className="p-10 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-[3rem] text-white overflow-hidden relative shadow-2xl shadow-indigo-100 group">
        <div className="relative z-10 text-right space-y-6">
          <div className="space-y-1">
             <h2 className="text-3xl font-black tracking-tight flex items-center gap-3">
               <ActivityIcon className="text-indigo-200" />
               ملخص ذكي اليوم
             </h2>
             <p className="text-indigo-100/80 font-bold">بناءً على آخر {events.length} أحداث في النظام</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            {events.slice(0, 2).map((e, i) => (
              <div key={i} className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 hover:bg-white/20 transition-all cursor-default">
                <p className="text-sm font-bold leading-relaxed">{e.message}</p>
                <span className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mt-2 block">{formatRelativeTime(e.createdAt)}</span>
              </div>
            ))}
          </div>

          <button onClick={() => navigate('/requests')} className="px-8 py-3 bg-white text-indigo-600 rounded-[1.5rem] font-black text-sm hover:scale-105 transition-all shadow-xl shadow-indigo-900/40 active:scale-95">
             متابعة كافة الإجراءات
          </button>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-white/10 rounded-full -ml-32 -mt-32 blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-60 h-60 bg-blue-400/20 rounded-full blur-3xl transform translate-y-20"></div>
        <div className="absolute top-1/2 left-1/2 w-40 h-40 bg-indigo-400/10 rounded-full blur-3xl"></div>
      </div>
    </div>
  );
}

function formatRelativeTime(timestamp: any) {
  if (!timestamp || typeof timestamp.toDate !== 'function') return '';
  const now = new Date();
  const date = timestamp.toDate();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'منذ لحظات';
  if (diffInSeconds < 3600) return `منذ ${Math.floor(diffInSeconds / 60)} دقيقة`;
  if (diffInSeconds < 86400) return `منذ ${Math.floor(diffInSeconds / 3600)} ساعة`;
  return date.toLocaleDateString('ar-SA');
}
