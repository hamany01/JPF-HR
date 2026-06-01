import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  runTransaction, 
  serverTimestamp, 
  Timestamp,
  getDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { createCaseEvent } from '../services/eventService';
import { 
  Plus, 
  Trash2, 
  Clock, 
  CreditCard, 
  Banknote, 
  Building2, 
  AlertTriangle, 
  Loader2, 
  CheckCircle2,
  Calendar as CalendarIcon,
  MessageSquare,
  DollarSign,
  Check,
  CheckCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface Payment {
  id: string;
  amount: number;
  method: 'bank_transfer' | 'cash' | 'execution_office';
  direction: 'in';
  date: Timestamp;
  notes: string;
  createdBy: string;
  creatorName?: string;
  createdAt: Timestamp;
}

interface CasePaymentsTabProps {
  caseId: string;
  claimAmount: number;
  receivedAmount: number;
  remainingAmount: number;
  isClosed: boolean;
  onRefresh: () => void;
}

export default function CasePaymentsTab({ 
  caseId, 
  claimAmount, 
  receivedAmount, 
  remainingAmount,
  isClosed,
  onRefresh 
}: CasePaymentsTabProps) {
  const { user, profile } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [usersCache, setUsersCache] = useState<Record<string, string>>({});

  // Form State
  const [form, setForm] = useState({
    amount: '',
    method: 'bank_transfer' as const,
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // --- STATE FOR MANUAL PAYMENT PLANS (Phase 2) ---
  const [caseInfo, setCaseInfo] = useState<any>(null);
  const [paymentPlans, setPaymentPlans] = useState<any[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [submittingPlan, setSubmittingPlan] = useState(false);
  const [newPlan, setNewPlan] = useState({
    installmentAmount: '',
    dueDate: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const isJPFManager = ['admin', 'company_manager', 'assistant_manager'].includes(profile?.role || '');
  const isSalesEmployee = profile?.role === 'sales_employee';

  // Fetch Parent Case Info
  useEffect(() => {
    if (!caseId) return;
    const fetchCaseInfo = async () => {
      try {
        const caseDoc = await getDoc(doc(db, 'cases', caseId));
        if (caseDoc.exists()) {
          setCaseInfo(caseDoc.data());
        }
      } catch (err) {
        console.error("Error fetching case info for layout:", err);
      }
    };
    fetchCaseInfo();
  }, [caseId]);

  // Fetch plans
  const fetchPaymentPlans = async () => {
    if (!caseId) return;
    setPlansLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const response = await fetch(`/api/cases/${caseId}/payment-plans`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setPaymentPlans(result.data);
      }
    } catch (error) {
      console.error("Error loading payment plans:", error);
    } finally {
      setPlansLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentPlans();
  }, [caseId]);

  // Create manual plan installment
  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newPlan.installmentAmount);
    if (!newPlan.dueDate || isNaN(amt) || amt <= 0) {
      alert("الرجاء إدخال تفاصيل صحيحة للقسط.");
      return;
    }

    setSubmittingPlan(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const response = await fetch(`/api/cases/${caseId}/payment-plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          installmentAmount: amt,
          dueDate: newPlan.dueDate,
          notes: newPlan.notes
        })
      });

      const result = await response.json();
      if (result.success) {
        setNewPlan({
          installmentAmount: '',
          dueDate: new Date().toISOString().split('T')[0],
          notes: ''
        });
        fetchPaymentPlans();
      } else {
        alert("فشل إضافة القسط: " + result.message);
      }
    } catch (err: any) {
      alert("خطأ: " + err.message);
    } finally {
      setSubmittingPlan(false);
    }
  };

  // Toggle/Update installment status
  const handleUpdatePlanStatus = async (planId: string, newStatus: string, paidAmountVal: number) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const response = await fetch(`/api/payment-plans/${planId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: newStatus,
          paidAmount: parseFloat(String(paidAmountVal)) || 0
        })
      });

      const result = await response.json();
      if (result.success) {
        fetchPaymentPlans();
        onRefresh(); // sync the master received and remaining amounts
      } else {
        alert("حدث خطأ أثناء تحديث حالة القسط: " + result.message);
      }
    } catch (error: any) {
      alert("خطأ في الاتصال بالخادم: " + error.message);
    }
  };

  const getWhatsAppLink = (plan: any) => {
    const phone = caseInfo?.defendantPhone || '';
    let cleaned = phone.trim().replace(/\s+/g, '');
    if (cleaned.startsWith('05')) {
      cleaned = '966' + cleaned.substring(1);
    }
    const name = caseInfo?.defendantName || 'العميل الكريم';
    const rawDate = new Date(plan.dueDate);
    const dateFormatted = !isNaN(rawDate.getTime()) ? rawDate.toLocaleDateString('en-GB') : plan.dueDate;
    const msg = `عزيزنا العميل: ${name}، نود تذكيركم بوجود قسط مستحق بقيمة ${plan.installmentAmount} ر.س ومستحق السداد بحلول تاريخ ${dateFormatted}. يرجى التكرم بالسداد في أقرب وقت لتفادي أي إجراءات نظامية. شاكرين ومقدرين لكم تعاونكم الرائع.`;
    return `https://wa.me/${cleaned}?text=${encodeURIComponent(msg)}`;
  };

  const canManagePayments = ['admin', 'company_manager', 'law_manager'].includes(profile?.role || '');

  useEffect(() => {
    if (!caseId) return;

    const q = query(
      collection(db, 'cases', caseId, 'payments'),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const paymentData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Payment[];
      
      setPayments(paymentData);
      setLoading(false);

      // Fetch creator names for new users in cache
      const uniqueUids = Array.from(new Set(paymentData.map(p => p.createdBy)));
      const newUids = uniqueUids.filter(uid => !usersCache[uid]);
      
      if (newUids.length > 0) {
        const newCache = { ...usersCache };
        for (const uid of newUids) {
          try {
            const userDoc = await getDoc(doc(db, 'users', uid));
            if (userDoc.exists()) {
              newCache[uid] = userDoc.data().name || 'مستخدم';
            } else {
              newCache[uid] = 'مستخدم غير معروف';
            }
          } catch (e) {
            newCache[uid] = 'مجهول';
          }
        }
        setUsersCache(newCache);
      }
    });

    return () => unsubscribe();
  }, [caseId]);

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(form.amount);

    if (isNaN(amountNum) || amountNum <= 0) {
      alert('الرجاء إدخال مبلغ صحيح');
      return;
    }

    if (amountNum > remainingAmount && !showWarning) {
      setShowWarning(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const transactionResult = await runTransaction(db, async (transaction) => {
        const caseRef = doc(db, 'cases', caseId);
        const caseSnap = await transaction.get(caseRef);

        if (!caseSnap.exists()) throw new Error('Document does not exist!');

        const currentReceived = caseSnap.data().receivedAmount || 0;
        const currentClaim = caseSnap.data().claimAmount || 0;
        
        const newReceived = currentReceived + amountNum;
        const newRemaining = currentClaim - newReceived;

        // Add payment document
        const newPaymentRef = doc(collection(db, 'cases', caseId, 'payments'));
        transaction.set(newPaymentRef, {
          amount: amountNum,
          method: form.method,
          direction: 'in',
          date: Timestamp.fromDate(new Date(form.date)),
          notes: form.notes,
          createdBy: user?.uid,
          createdAt: serverTimestamp()
        });

        // Update case totals
        transaction.update(caseRef, {
          receivedAmount: newReceived,
          remainingAmount: newRemaining,
          updatedAt: serverTimestamp()
        });

        return { requestSerialNumber: caseSnap.data().requestSerialNumber || '', newRemaining, newReceived };
      });

      // استدعاء createCaseEvent فوراً بعد نجاح الترانزكشن
      if (transactionResult) {
        await createCaseEvent({
          caseId: caseId,
          caseSerialNumber: transactionResult.requestSerialNumber,
          type: 'payment_added',
          message: `تم إضافة سداد بمبلغ ${amountNum} ريال للقضية ${transactionResult.requestSerialNumber}. المتبقي: ${transactionResult.newRemaining} ريال.`,
          payload: {
            paymentAmount: amountNum,
            remainingAmount: transactionResult.newRemaining,
            caseSerialNumber: transactionResult.requestSerialNumber,
            paymentDate: new Date(form.date).toISOString(),
          },
          createdBy: user?.uid || '',
          createdByName: profile?.name || 'مستخدم'
        });

        if (transactionResult.newRemaining <= 0) {
          await createCaseEvent({
            caseId: caseId,
            caseSerialNumber: transactionResult.requestSerialNumber,
            type: 'case_paid_off',
            message: `تم سداد القضية ${transactionResult.requestSerialNumber} بالكامل. إجمالي المبلغ المحصل: ${transactionResult.newReceived} ريال.`,
            payload: { 
              caseSerialNumber: transactionResult.requestSerialNumber,
              totalCollected: transactionResult.newReceived 
            },
            createdBy: user?.uid || '',
            createdByName: profile?.name || 'مستخدم'
          });
        }
      }

      setForm({
        amount: '',
        method: 'bank_transfer',
        date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      setShowWarning(false);
      onRefresh();
    } catch (error: any) {
      console.error('Transaction failed: ', error);
      alert('فشل تسجيل الحركة: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePayment = async (paymentId: string, amount: number) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الحركة؟ سيتم إعادة احتساب المبلغ المتبقي.')) return;

    try {
      await runTransaction(db, async (transaction) => {
        const caseRef = doc(db, 'cases', caseId);
        const paymentRef = doc(db, 'cases', caseId, 'payments', paymentId);
        
        const caseSnap = await transaction.get(caseRef);
        if (!caseSnap.exists()) throw new Error('Case not found');

        const currentReceived = caseSnap.data().receivedAmount || 0;
        const currentClaim = caseSnap.data().claimAmount || 0;

        const newReceived = currentReceived - amount;
        const newRemaining = currentClaim - newReceived;

        transaction.delete(paymentRef);
        transaction.update(caseRef, {
          receivedAmount: newReceived,
          remainingAmount: newRemaining,
          updatedAt: serverTimestamp()
        });

        // Log deletion event
        transaction.set(doc(collection(db, 'appEvents')), {
          category: 'case',
          caseId: caseId,
          serialNumber: caseSnap.data().requestSerialNumber || '',
          type: 'case_status_changed', // Using status changed as a proxy for financial update event
          message: `تم حذف سداد بمبلغ ${amount} ريال من القضية ${caseSnap.data().requestSerialNumber || ''}. المتبقي الجديد: ${newRemaining} ريال.`,
          payload: { removedAmount: amount, remainingAmount: newRemaining },
          createdAt: serverTimestamp(),
          createdBy: user?.uid,
          createdByName: profile?.name || 'مستخدم',
          seenBy: []
        });
      });
      onRefresh();
    } catch (error: any) {
      alert('فشل الحذف: ' + error.message);
    }
  };

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'bank_transfer': return 'تحويل بنكي';
      case 'cash': return 'كاش';
      case 'execution_office': return 'من قبل التنفيذ';
      default: return method;
    }
  };

  const getMethodBadge = (method: string) => {
    switch (method) {
      case 'bank_transfer': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'cash': return 'bg-green-50 text-green-700 border-green-100';
      case 'execution_office': return 'bg-purple-50 text-purple-700 border-purple-100';
      default: return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'bank_transfer': return <Building2 size={14} />;
      case 'cash': return <Banknote size={14} />;
      case 'execution_office': return <CreditCard size={14} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-10" dir="rtl">
      {/* Add Payment Form */}
      {canManagePayments && !isClosed && (
        <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl">
              <Plus size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">إضافة حركة سداد جديدة</h3>
              <p className="text-xs text-slate-500 font-medium tracking-tight">سيتم تحديث المبلغ المتبقي للقضية تلقائياً</p>
            </div>
          </div>

          <form onSubmit={handleAddPayment} className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">مبلغ السداد</label>
              <div className="relative">
                <input 
                  required
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({...form, amount: e.target.value})}
                  className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3.5 focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-black text-slate-900 font-mono"
                  placeholder="0.00"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">ر.س</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">نوع الدفع</label>
              <select 
                value={form.method}
                onChange={(e) => setForm({...form, method: e.target.value as any})}
                className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3.5 focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-bold text-slate-700"
              >
                <option value="bank_transfer">تحويل بنكي</option>
                <option value="cash">كاش</option>
                <option value="execution_office">من قبل التنفيذ</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">تاريخ الحركة</label>
              <div className="relative">
                <input 
                  required
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({...form, date: e.target.value})}
                  className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3.5 focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-bold text-slate-700 text-right"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">المصدر / ملاحظات</label>
              <input 
                type="text"
                value={form.notes}
                onChange={(e) => setForm({...form, notes: e.target.value})}
                placeholder="رقم التحويل أو تفاصيل"
                className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3.5 focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-medium text-slate-700"
              />
            </div>

            <div className="md:col-span-4 flex items-center justify-between pt-2">
              <AnimatePresence>
                {showWarning && (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    key="warning"
                    className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-100 rounded-2xl text-amber-700 text-xs font-bold"
                  >
                    <AlertTriangle size={18} className="text-amber-500 shrink-0" />
                    <span>المبلغ المدخل أكبر من المتبقي ({remainingAmount.toLocaleString()} ر.س). هل أنت متأكد؟</span>
                    <button 
                      type="button"
                      onClick={() => setShowWarning(false)}
                      className="mr-2 underline hover:text-amber-900"
                    >
                      تعديل
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <button 
                type="submit"
                disabled={isSubmitting}
                className={cn(
                  "mr-auto px-8 py-4 rounded-2xl font-black transition-all flex items-center gap-3 shadow-xl shadow-indigo-100 active:scale-95",
                  showWarning ? "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-100" : "bg-indigo-600 hover:bg-indigo-700 text-white"
                )}
              >
                {isSubmitting ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={18} />
                )}
                {showWarning ? 'تأكيد تجاوز المتبقي' : 'إضافة حركة سداد'}
              </button>
            </div>
          </form>
        </div>
      )}

      {isClosed && (
        <div className="bg-blue-50 border border-blue-100 rounded-3xl p-6 flex items-center gap-4 text-blue-700 font-bold">
           <AlertTriangle size={24} />
           <span>هذه القضية مغلقة، لا يمكن إضافة حركات مالية جديدة.</span>
        </div>
      )}

      {/* Payments History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-4">
           <h4 className="text-lg font-black text-slate-900">سجل الحركات المالية الموثقة</h4>
           <div className="flex items-center gap-4 text-xs font-bold">
             <div className="flex items-center gap-2 text-slate-500">
               <span>إجمالي المطالبة:</span>
               <span className="font-mono text-slate-900">{claimAmount.toLocaleString()} ر.س</span>
             </div>
             <div className="flex items-center gap-2 text-green-600">
               <span>إجمالي المستلم:</span>
               <span className="font-mono">{receivedAmount.toLocaleString()} ر.س</span>
             </div>
           </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">التاريخ</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">المبلغ</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">طريقة الدفع</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">الملاحظات / المصدر</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">المسؤول</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <Loader2 size={32} className="text-indigo-600 animate-spin mx-auto mb-4" />
                    <span className="text-slate-400 font-bold">جاري تحميل السجل المالي...</span>
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <CreditCard size={32} className="text-slate-200" />
                    </div>
                    <p className="text-slate-400 font-bold">لا يوجد أي حركات مالية مسجلة بعد</p>
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 font-mono tracking-tight">
                          {p.date?.toDate().toLocaleDateString('en-GB')}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {p.date?.toDate().toLocaleDateString('ar-SA-u-ca-islamic-uma-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' })} هـ
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="text-lg font-black text-slate-900 font-mono tracking-tighter">
                        {p.amount?.toLocaleString()} <span className="text-[10px] font-bold text-slate-400">ر.س</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black border w-fit shadow-xs",
                        getMethodBadge(p.method)
                      )}>
                        {getMethodIcon(p.method)}
                        {getMethodLabel(p.method)}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-sm text-slate-500 font-medium max-w-xs">{p.notes || '—'}</p>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                        <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[10px] text-slate-400">
                           <Clock size={12} />
                        </div>
                        {usersCache[p.createdBy] || 'تحميل...'}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-left">
                      {canManagePayments && !isClosed && (
                        <button 
                          onClick={() => handleDeletePayment(p.id, p.amount)}
                          className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                          title="حذف الحركة"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {payments.length > 0 && (
              <tfoot>
                <tr className="bg-slate-900 text-white">
                   <td className="px-6 py-6 font-black uppercase tracking-widest text-[10px] text-slate-400">الإجمالي المستلم</td>
                   <td className="px-6 py-6 text-2xl font-black font-mono tracking-tighter" colSpan={2}>
                      {payments.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()} <span className="text-xs font-medium text-slate-500">ر.س</span>
                   </td>
                   <td className="px-6 py-6 text-left text-xs font-bold text-slate-500" colSpan={3}>
                      تطابق الحركات مع إجمالي القضية: {payments.reduce((acc, curr) => acc + curr.amount, 0) === receivedAmount ? 'نعم ✅' : 'لا ❌'}
                   </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ========================================================= */}
      {/* PHASE 2 - MANUAL PAYMENT PLANS SECTION */}
      {/* ========================================================= */}
      <div className="border-t border-slate-100 pt-10 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <CalendarIcon size={22} className="text-indigo-600" />
              <span>خطة الأقساط اليدوية لجدولة السداد</span>
            </h3>
            <p className="text-xs text-slate-400 font-medium mt-1">تتيح لمدراء النظام جدولة وجباية مستحقات القضية على شكل دفعات مرنة</p>
          </div>
        </div>

        {/* 1) Add Installment Form (Managers Only) */}
        {isJPFManager && !isClosed && (
          <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-indigo-600 text-white rounded-xl">
                <Plus size={20} />
              </div>
              <div>
                <h4 className="text-lg font-black text-slate-900">جدولة قسط جديد للعميل</h4>
                <p className="text-xs text-slate-500 font-medium">قم بتحديد قيمة الاستحقاق وجدولته زمنياً</p>
              </div>
            </div>

            <form onSubmit={handleCreatePlan} className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end font-sans">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">قيمة القسط المستحق</label>
                <div className="relative">
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={newPlan.installmentAmount}
                    onChange={(e) => setNewPlan({ ...newPlan, installmentAmount: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3.5 focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-black text-slate-900 font-mono"
                    placeholder="0.00"
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">ر.س</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">تاريخ الاستحقاق</label>
                <input
                  required
                  type="date"
                  value={newPlan.dueDate}
                  onChange={(e) => setNewPlan({ ...newPlan, dueDate: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3.5 focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-bold text-slate-705 text-right"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">ملاحظات إضافية</label>
                <div className="flex gap-4">
                  <input
                    type="text"
                    value={newPlan.notes}
                    onChange={(e) => setNewPlan({ ...newPlan, notes: e.target.value })}
                    placeholder="قسط الدفعة الأولى أو ملاحظة خاصة..."
                    className="flex-1 bg-white border border-slate-200 rounded-2xl px-5 py-3.5 focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-medium text-slate-700"
                  />
                  <button
                    type="submit"
                    disabled={submittingPlan}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3.5 rounded-2xl font-black transition-all flex items-center justify-center gap-2 active:scale-95 text-sm whitespace-nowrap shadow-xl shadow-indigo-100"
                  >
                    {submittingPlan ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                    جدولة القسط
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* 2) Installment Schedule Table */}
        <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">تاريخ الاستحقاق</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">قيمة القسط</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">المبلغ المدفوع فعلياً</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">ملاحظات</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">الحالة</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {plansLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <Loader2 size={32} className="text-indigo-600 animate-spin mx-auto mb-4" />
                    <span className="text-slate-400 font-bold">جاري تحميل جدول الأقساط...</span>
                  </td>
                </tr>
              ) : paymentPlans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <CalendarIcon size={32} className="text-slate-200" />
                    </div>
                    <p className="text-slate-400 font-bold">لم تتم جدولة أي أقساط يدوية لهذه القضية حتى الآن.</p>
                  </td>
                </tr>
              ) : (
                paymentPlans.map((plan: any) => {
                  const rawDate = new Date(plan.dueDate);
                  const dateFormatted = !isNaN(rawDate.getTime()) ? rawDate.toLocaleDateString('en-GB') : plan.dueDate;
                  const dateHijri = !isNaN(rawDate.getTime()) ? rawDate.toLocaleDateString('ar-SA-u-ca-islamic-uma-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' }) : '';
                  
                  return (
                    <tr key={plan.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 font-mono tracking-tight">
                            {dateFormatted}
                          </span>
                          {dateHijri && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              {dateHijri} هـ
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-lg font-black text-slate-900 font-mono tracking-tighter">
                          {plan.installmentAmount?.toLocaleString()} <span className="text-[10px] font-bold text-slate-400">ر.س</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-base font-bold text-slate-600 font-mono">
                          {plan.paidAmount?.toLocaleString() || '0'} <span className="text-[10px] font-bold text-slate-400">ر.س</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-sm text-slate-500 font-medium max-w-xs">{plan.notes || '—'}</p>
                      </td>
                      <td className="px-6 py-5">
                        <span className={cn(
                          "px-2.5 py-1.5 rounded-lg text-xs font-bold border block w-fit shadow-xs",
                          plan.status === 'paid' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                          plan.status === 'overdue' ? "bg-rose-50 text-rose-700 border-rose-100" :
                          "bg-amber-50 text-amber-700 border-amber-100"
                        )}>
                          {plan.status === 'paid' ? 'مسدد بالكامل' :
                           plan.status === 'overdue' ? 'متأخرات السداد' : 'قيد الانتظار'}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-left">
                        <div className="flex items-center justify-end gap-2">
                          {/* JPF managers actions */}
                          {isJPFManager && !isClosed && (
                            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all font-sans">
                              {/* If not paid yet, enable quick trigger pay */}
                              {plan.status !== 'paid' && (
                                <>
                                  <button
                                    onClick={() => {
                                      const confirmPay = window.confirm(`هل تريد تسديد هذا القسط بالكامل بقيمة ${plan.installmentAmount} ر.س؟`);
                                      if (confirmPay) {
                                        handleUpdatePlanStatus(plan.id, 'paid', plan.installmentAmount);
                                      }
                                    }}
                                    className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-1 shrink-0"
                                    title="تسجيل سداد بالكامل"
                                  >
                                    <CheckCircle size={14} />
                                    <span>تسديد بالكامل</span>
                                  </button>
                                  <button
                                    onClick={() => handleUpdatePlanStatus(plan.id, 'overdue', plan.paidAmount || 0)}
                                    className="px-2 py-1.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl text-xs font-semibold hover:bg-rose-100 transition-all shrink-0"
                                    title="وضع كمتأخر"
                                  >
                                    متأخر
                                  </button>
                                </>
                              )}
                              {plan.status === 'paid' && (
                                <button
                                  onClick={() => handleUpdatePlanStatus(plan.id, 'pending', 0)}
                                  className="px-2 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all shrink-0"
                                  title="إعادة جارية للانتظار"
                                >
                                  إعادة للانتظار
                                </button>
                              )}
                            </div>
                          )}

                          {/* WhatsApp Reminder (Managers and Law Firms can send reminders; NOT sales_employee) */}
                          {!isSalesEmployee && (
                            <a
                              href={getWhatsAppLink(plan)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2.5 bg-emerald-50 hover:bg-emerald-110 text-emerald-600 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs font-black self-center"
                              title="توليد وتلقيم تذكير بالواتساب"
                            >
                              <MessageSquare size={16} />
                              <span className="hidden sm:inline">إرسال تذكير بالواتساب</span>
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
