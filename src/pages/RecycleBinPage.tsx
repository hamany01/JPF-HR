import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { auth } from '../firebase/config';
import { Loader2, Trash2, RotateCcw, ShieldAlert, FileText, Calendar, DollarSign, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

export default function RecycleBinPage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'cases' | 'plans'>('cases');
  const [cases, setCases] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isAdmin = profile?.role === 'admin';

  const fetchData = async () => {
    setLoading(true);
    try {
      const activeUser = auth.currentUser;
      const token = await activeUser?.getIdToken();
      if (!token) {
        console.error('No authorization token found');
        setLoading(false);
        return;
      }

      if (activeTab === 'cases') {
        const res = await fetch('/api/recycle-bin/cases', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();
        if (result.success) {
          setCases(result.data || []);
        } else {
          console.error(result.message);
        }
      } else {
        const res = await fetch('/api/recycle-bin/payment-plans', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();
        if (result.success) {
          setPlans(result.data || []);
        } else {
          console.error(result.message);
        }
      }
    } catch (err) {
      console.error('Error fetching recycle bin items:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [activeTab, isAdmin]);

  const handleRestoreCase = async (caseId: string) => {
    if (!window.confirm('هل أنت متأكد من استرجاع هذه القضية؟ ستعرض مجدداً في قائمة القضايا النشطة.')) {
      return;
    }
    setActionLoading(`restore-${caseId}`);
    try {
      const activeUser = auth.currentUser;
      const token = await activeUser?.getIdToken();
      const res = await fetch(`/api/cases/${caseId}/restore`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success) {
        alert('تم استعادة القضية بنجاح!');
        fetchData();
      } else {
        alert(`فشل الاسترجاع: ${result.message}`);
      }
    } catch (err: any) {
      alert(`خطأ: ${err.message}`);
    }
    setActionLoading(null);
  };

  const handleHardDeleteCase = async (caseId: string) => {
    const confirmation = window.confirm(
      'تحذير كارثي: هل أنت متأكد تماماً من الحذف النهائي لهذه القضية؟\nسيؤدي هذا إلى حذف مستند القضية بالكامل وجميع دفعات خطة السداد المرتبطة بها نهائياً ولا يمكن التراجع عن هذا الإجراء!'
    );
    if (!confirmation) return;

    setActionLoading(`delete-${caseId}`);
    try {
      const activeUser = auth.currentUser;
      const token = await activeUser?.getIdToken();
      const res = await fetch(`/api/cases/${caseId}/hard-delete`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success) {
        alert('تم حذف القضية وجميع متعلقاتها المالية نهائياً بنجاح.');
        fetchData();
      } else {
        alert(`فشل الحذف النهائي: ${result.message}`);
      }
    } catch (err: any) {
      alert(`خطأ: ${err.message}`);
    }
    setActionLoading(null);
  };

  const handleRestorePlan = async (planId: string) => {
    if (!window.confirm('هل أنت متأكد من استرجاع هذا القسط الاستحقاقي؟')) {
      return;
    }
    setActionLoading(`restore-${planId}`);
    try {
      const activeUser = auth.currentUser;
      const token = await activeUser?.getIdToken();
      const res = await fetch(`/api/payment-plans/${planId}/restore`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success) {
        alert('تم استرجاع القسط بنجاح في خطة الدفع الخاصة بالقضية.');
        fetchData();
      } else {
        alert(`فشل الاسترجاع: ${result.message}`);
      }
    } catch (err: any) {
      alert(`خطأ: ${err.message}`);
    }
    setActionLoading(null);
  };

  const handleHardDeletePlan = async (planId: string) => {
    if (!window.confirm('تحذير: هل أنت متأكد من حذف هذا القسط نهائياً من النظام؟ لا يمكن العثور عليه لاحقاً.')) {
      return;
    }
    setActionLoading(`delete-${planId}`);
    try {
      const activeUser = auth.currentUser;
      const token = await activeUser?.getIdToken();
      const res = await fetch(`/api/payment-plans/${planId}/hard-delete`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success) {
        alert('تم حذف القسط نهائياً.');
        fetchData();
      } else {
        alert(`فشل الحذف النهائي: ${result.message}`);
      }
    } catch (err: any) {
      alert(`خطأ: ${err.message}`);
    }
    setActionLoading(null);
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] p-6 text-center" dir="rtl">
        <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-rose-950 mb-2 font-display">منطقة محظورة</h2>
        <p className="text-slate-500 max-w-md font-sans text-sm">
          سلة المحذوفات متاحة حصرياً لمدير النظام الشامل (Administrator) لإنجاز عمليات التفتيش والمراقبة الأمنية والتحقق المالي واسترجاع البيانات.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header section with Display Typography */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>سلة المحذوفات والرقابة الفنية</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1 font-sans">
            مراجعة، استرداد، وحذف البيانات مؤقتاً أو نهائياً من قبل الإدارة العليا بموجب سجلات الجودة للشركة.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
        >
          <RefreshCw size={14} className={cn(loading && "animate-spin")} />
          <span>تحديث السلة</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-px">
        <button
          onClick={() => setActiveTab('cases')}
          className={cn(
            "px-6 py-3 font-semibold text-sm transition-all relative",
            activeTab === 'cases' 
              ? "text-indigo-600 border-b-2 border-indigo-600" 
              : "text-slate-400 hover:text-slate-600"
          )}
        >
          <div className="flex items-center gap-2">
            <FileText size={16} />
            <span>القضايا المحذوفة ({cases.length})</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('plans')}
          className={cn(
            "px-6 py-3 font-semibold text-sm transition-all relative",
            activeTab === 'plans' 
              ? "text-indigo-600 border-b-2 border-indigo-600" 
              : "text-slate-400 hover:text-slate-600"
          )}
        >
          <div className="flex items-center gap-2">
            <Calendar size={16} />
            <span>الأقساط المحذوفة ({plans.length})</span>
          </div>
        </button>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <div className="text-slate-500 text-xs font-medium">جاري استرداد محتويات سلة الحذف...</div>
        </div>
      ) : activeTab === 'cases' ? (
        /* Cases Table Card */
        <div className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-400 tracking-wider">
                  <th className="px-6 py-4">رقم الطلب</th>
                  <th className="px-6 py-4">المدعي</th>
                  <th className="px-6 py-4">المنفذ ضده</th>
                  <th className="px-6 py-4">المطالبة المالية</th>
                  <th className="px-6 py-4">حُذف بواسطة</th>
                  <th className="px-6 py-4 text-left">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cases.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <AlertCircle size={40} className="text-slate-200" />
                        <span className="font-bold text-slate-400 text-sm">سلة محذوفات القضايا فارغة حالياً</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  cases.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors text-xs font-medium text-slate-700">
                      <td className="px-6 py-5">
                        <span className="font-mono font-bold text-indigo-600">{item.requestSerialNumber || item.requestNumber || '—'}</span>
                      </td>
                      <td className="px-6 py-5 font-bold text-slate-900">{item.clientName || '—'}</td>
                      <td className="px-6 py-5 font-bold text-slate-900">{item.defendantName || '—'}</td>
                      <td className="px-6 py-5 font-bold text-rose-600 font-mono">
                        {item.claimAmount?.toLocaleString() || item.amountClaimed?.toLocaleString() || '0'} ر.س
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{item.deletedByName}</span>
                          {item.deletedAt && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(item.deletedAt._seconds * 1000 || item.deletedAt).toLocaleString('en-GB')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-left">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleRestoreCase(item.id)}
                            disabled={actionLoading !== null}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 hover:text-white border border-indigo-200 rounded-xl text-[11px] font-bold text-indigo-700 transition-all flex items-center gap-1 disabled:opacity-50"
                            title="استعادة القضية"
                          >
                            <RotateCcw size={12} />
                            <span>استرجاع</span>
                          </button>
                          <button
                            onClick={() => handleHardDeleteCase(item.id)}
                            disabled={actionLoading !== null}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-600 hover:text-white border border-rose-200 rounded-xl text-[11px] font-bold text-rose-700 transition-all flex items-center gap-1 disabled:opacity-50"
                            title="حذف نهائي"
                          >
                            <Trash2 size={12} />
                            <span>حذف نهائي</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Payment Plans (Installments) Table Card */
        <div className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-400 tracking-wider">
                  <th className="px-6 py-4">رقم القضية</th>
                  <th className="px-6 py-4">اسم العميل</th>
                  <th className="px-6 py-4">المنفذ ضده</th>
                  <th className="px-6 py-4">مبلغ القسط</th>
                  <th className="px-6 py-4">تاريخ الاستحقاق</th>
                  <th className="px-6 py-4">حُذف بواسطة</th>
                  <th className="px-6 py-4 text-left">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {plans.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <AlertCircle size={40} className="text-slate-200" />
                        <span className="font-bold text-slate-400 text-sm">سلة محذوفات الأقساط فارغة حالياً</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  plans.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors text-xs font-medium text-slate-700">
                      <td className="px-6 py-5">
                        <span className="font-mono font-bold text-indigo-600">{item.serialNumber}</span>
                      </td>
                      <td className="px-6 py-5 font-bold text-slate-900">{item.clientName}</td>
                      <td className="px-6 py-5 font-bold text-slate-900">{item.defendantName}</td>
                      <td className="px-6 py-5 font-bold text-amber-600 font-mono">
                        {item.installmentAmount?.toLocaleString()} ر.س
                      </td>
                      <td className="px-6 py-5 font-mono">{item.dueDate}</td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{item.deletedByName}</span>
                          {item.deletedAt && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(item.deletedAt._seconds * 1000 || item.deletedAt).toLocaleString('en-GB')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-left">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleRestorePlan(item.id)}
                            disabled={actionLoading !== null}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 hover:text-white border border-indigo-200 rounded-xl text-[11px] font-bold text-indigo-700 transition-all flex items-center gap-1 disabled:opacity-50"
                            title="استعادة القسط"
                          >
                            <RotateCcw size={12} />
                            <span>استرجاع</span>
                          </button>
                          <button
                            onClick={() => handleHardDeletePlan(item.id)}
                            disabled={actionLoading !== null}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-600 hover:text-white border border-rose-200 rounded-xl text-[11px] font-bold text-rose-700 transition-all flex items-center gap-1 disabled:opacity-50"
                            title="حذف نهائي"
                          >
                            <Trash2 size={12} />
                            <span>حذف نهائي</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
