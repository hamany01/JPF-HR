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
import { db } from '../firebase/config';
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
  Calendar as CalendarIcon
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
    </div>
  );
}
