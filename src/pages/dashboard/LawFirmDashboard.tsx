import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  where,
  getDocs
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  FileText, 
  Scale, 
  TrendingUp, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  Building2,
  ExternalLink,
  ChevronLeft,
  Loader2,
  AlertTriangle,
  CreditCard
} from 'lucide-react';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { arSA } from 'date-fns/locale';

export default function LawFirmDashboard() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [requests, setRequests] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const lawFirmId = profile?.lawFirmId || 'LAW-JPF-001';

  useEffect(() => {
    if (authLoading || !profile) return;

    setLoading(true);

    // Fetch user names for mapping if needed
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

    // 1. Listen to requests assigned to this law firm
    const qRequests = query(
      collection(db, 'requests'), 
      where('lawFirmId', '==', lawFirmId)
    );

    const unsubscribeRequests = onSnapshot(qRequests, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error subscribing to requests in LawFirmDashboard:", error);
    });

    // 2. Listen to cases assigned to this law firm
    const qCases = query(
      collection(db, 'cases'), 
      where('lawFirmId', '==', lawFirmId)
    );

    const unsubscribeCases = onSnapshot(qCases, (snapshot) => {
      let docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort by creation time manually to avoid indexing requirements
      docs.sort((a: any, b: any) => {
        const getMs = (val: any) => {
          if (!val) return 0;
          if (typeof val.toDate === 'function') return val.toDate().getTime();
          return new Date(val).getTime() || 0;
        };
        return getMs(b.createdAt) - getMs(a.createdAt);
      });
      setCases(docs);
      setLoading(false);
    }, (error) => {
      console.error("Error subscribing to cases in LawFirmDashboard:", error);
      setLoading(false);
    });

    return () => {
      unsubscribeRequests();
      unsubscribeCases();
    };
  }, [user, profile, authLoading, lawFirmId]);

  // Calculations for KPI Stats
  const activeRequestsCount = useMemo(() => {
    return requests.filter(r => ['pending_law_review', 'approved_preliminary'].includes(r.status)).length;
  }, [requests]);

  const openCasesCount = useMemo(() => {
    return cases.filter(c => c.status !== 'closed').length;
  }, [cases]);

  const closedCasesThisMonthCount = useMemo(() => {
    const startOfCurrentMonth = startOfMonth(new Date());
    const endOfCurrentMonth = endOfMonth(new Date());

    return cases.filter(c => {
      if (c.status !== 'closed') return false;
      const dateVal = c.updatedAt || c.createdAt;
      if (!dateVal) return false;
      let d: Date;
      if (typeof dateVal.toDate === 'function') {
        d = dateVal.toDate();
      } else {
        d = new Date(dateVal);
      }
      return d >= startOfCurrentMonth && d <= endOfCurrentMonth;
    }).length;
  }, [cases]);

  const totalOpenClaimsAmount = useMemo(() => {
    return cases
      .filter(c => c.status !== 'closed')
      .reduce((sum, c) => sum + (Number(c.claimAmount) || 0), 0);
  }, [cases]);

  // Tables
  const recentRequests = useMemo(() => {
    return requests
      .filter(r => r.status === 'pending_law_review')
      .slice(0, 5);
  }, [requests]);

  const recentOpenCases = useMemo(() => {
    return cases
      .filter(c => c.status !== 'closed')
      .slice(0, 5);
  }, [cases]);

  const formatCurrency = (val: number) => {
    return val.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 });
  };

  const formatDate = (val: any) => {
    if (!val) return '---';
    let d: Date;
    if (typeof val.toDate === 'function') {
      d = val.toDate();
    } else {
      d = new Date(val);
    }
    return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  if (authLoading || loading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4" dir="rtl">
      <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      <p className="text-slate-550 font-medium font-sans">جاري تحميل المعطيات وتحليل إحصائيات مكتب المحاماة...</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-10 text-right font-sans" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-slate-700" />
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">لوحة تحكم مكتب المحاماة</h1>
          </div>
          <p className="text-slate-400 font-bold mt-1 text-sm">
            مرحباً بك {profile?.name || 'مدير المكتب'}، إليك ملخص طلبات وقضايا المعاملات المسندة إليكم.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/requests')} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-xl shadow-slate-200 flex items-center gap-2 hover:bg-slate-800 transition-all">
            <FileText size={18} />
            <span>إدارة الطلبات</span>
          </button>
          <button onClick={() => navigate('/cases')} className="bg-white text-slate-900 border border-slate-200 px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm flex items-center gap-2 hover:bg-slate-50 transition-all">
            <Scale size={18} />
            <span>عرض القضايا</span>
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Active Requests */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-2xl text-white shadow-lg bg-indigo-500">
              <Clock size={24} />
            </div>
            <div className="text-right">
              <p className="text-slate-500 text-xs font-black uppercase tracking-widest">الطلبات النشطة</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{activeRequestsCount}</p>
            </div>
          </div>
          <p className="text-[10px] font-bold text-slate-400 mt-4">بحاجة لمراجعة أو قيد التنفيذ</p>
        </motion.div>

        {/* Card 2: Open Cases */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-2xl text-white shadow-lg bg-blue-600">
              <Scale size={24} />
            </div>
            <div className="text-right">
              <p className="text-slate-500 text-xs font-black uppercase tracking-widest">القضايا المفتوحة</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{openCasesCount}</p>
            </div>
          </div>
          <p className="text-[10px] font-bold text-slate-400 mt-4">ملفات قضائية جارية وتحت الإجراء</p>
        </motion.div>

        {/* Card 3: Closed Cases This Month */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-2xl text-white shadow-lg bg-emerald-500">
              <CheckCircle2 size={24} />
            </div>
            <div className="text-right">
              <p className="text-slate-500 text-xs font-black uppercase tracking-widest">المغلقة هذا الشهر</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{closedCasesThisMonthCount}</p>
            </div>
          </div>
          <p className="text-[10px] font-bold text-slate-400 mt-4">تم تسويتها وإغلاقها بنجاح</p>
        </motion.div>

        {/* Card 4: Total Open Claims Amount */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-2xl text-white shadow-lg bg-amber-500">
              <DollarSign size={24} />
            </div>
            <div className="text-right">
              <p className="text-slate-500 text-xs font-black uppercase tracking-widest">إجمالي مبالغ مطالبات المفتوحة</p>
              <p className="text-lg font-black text-slate-900 mt-1">{formatCurrency(totalOpenClaimsAmount)}</p>
            </div>
          </div>
          <p className="text-[10px] font-bold text-slate-400 mt-4">القيمة المالية الإجمالية للتنفيذ الجاري</p>
        </motion.div>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Requests Table */}
        <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm flex flex-col">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
              <FileText size={18} className="text-indigo-500" />
              <span>أحدث الطلبات الواردة (بانتظار المراجعة)</span>
            </h3>
            <button 
              onClick={() => navigate('/requests')} 
              className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              عرض الكل
            </button>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-right border-collapse min-w-[500px]">
              <thead>
                <tr className="bg-slate-50/30">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">رقم الطلب</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">العميل</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">مبلغ المطالبة</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">تاريخ الإنشاء</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs font-bold text-slate-900">{req.requestSerialNumber}</td>
                    <td className="px-6 py-4 text-xs font-black text-slate-705 text-slate-900">{req.clientName || '---'}</td>
                    <td className="px-6 py-4 font-mono text-xs font-bold text-amber-600">{formatCurrency(req.claimAmount || 0)}</td>
                    <td className="px-6 py-4 text-[11px] text-slate-400">{formatDate(req.createdAt)}</td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => navigate(`/requests?id=${req.id}`)}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold text-[10px] rounded-lg border border-indigo-100/40 transition-colors flex items-center gap-1 mx-auto"
                      >
                        <ExternalLink size={12} />
                        <span>فتح الطلب</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {recentRequests.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-xs font-bold text-slate-400">لا توجد طلبات واردة بانتظار المراجعة القانونية حالياً</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Open Cases Table */}
        <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm flex flex-col">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
              <Scale size={18} className="text-blue-500" />
              <span>أحدث القضايا المفتوحة (قيد العمل)</span>
            </h3>
            <button 
              onClick={() => navigate('/cases')} 
              className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              عرض الكل
            </button>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-right border-collapse min-w-[500px]">
              <thead>
                <tr className="bg-slate-50/30">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">رقم القضية</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">المنفذ ضده</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">مبلغ المطالبة</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">الحالة الحالية</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentOpenCases.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs font-bold text-slate-900">{c.requestSerialNumber || '---'}</td>
                    <td className="px-6 py-4 text-xs font-black text-slate-900">{c.defendantName || '---'}</td>
                    <td className="px-6 py-4 font-mono text-xs font-bold text-emerald-600">{formatCurrency(c.claimAmount || 0)}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-50 text-blue-600 border border-blue-100/40">
                        {c.statusLabel || 'قيد الإجراء'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => navigate(`/cases/${c.id}`)}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-[10px] rounded-lg border border-blue-100/40 transition-colors flex items-center gap-1 mx-auto"
                      >
                        <ExternalLink size={12} />
                        <span>فتح القضية</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {recentOpenCases.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-xs font-bold text-slate-400">لا توجد قضايا مفتوحة حالياً</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
