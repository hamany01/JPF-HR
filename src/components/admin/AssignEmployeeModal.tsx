import React, { useState, useEffect } from 'react';
import { useEmployees } from '../../hooks/useEmployees';
import { useAuth } from '../../hooks/useAuth';
import { X, UserCheck, AlertCircle, Info, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getFirestore, doc, updateDoc, serverTimestamp, addDoc, collection, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { createRequestEvent } from '../../services/eventService';
import { toast } from 'react-hot-toast';

interface AssignEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestId: string;
  requestSerialNumber: string;
  currentEmployeeId?: string;
  currentEmployeeName?: string;
  onSuccess?: () => void;
}

export const AssignEmployeeModal: React.FC<AssignEmployeeModalProps> = ({
  isOpen,
  onClose,
  requestId,
  requestSerialNumber,
  currentEmployeeId,
  currentEmployeeName,
  onSuccess
}) => {
  const { profile } = useAuth();
  const { employees, loading, error } = useEmployees();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedEmployeeId(currentEmployeeId || '');
    }
  }, [isOpen, currentEmployeeId]);

  if (!isOpen) return null;

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedEmployeeId) {
      toast.error('يرجى تحديد الموظف المسؤول');
      return;
    }

    const selectedEmployee = employees.find(emp => emp.uid === selectedEmployeeId);
    if (!selectedEmployee) {
      toast.error('الموظف المحدد غير موجود بسجلات النظام النشطة');
      return;
    }

    setIsSaving(true);
    try {
      const dbInstance = getFirestore();
      
      // 1. تحديث مستند الطلب بالتكليف الجديد
      const requestRef = doc(dbInstance, 'requests', requestId);
      await updateDoc(requestRef, {
        assignedEmployeeId: selectedEmployee.uid,
        assignedEmployeeName: selectedEmployee.name,
        updatedAt: serverTimestamp()
      });

      // 2. إرسال إشعار داخلي (In-App Notification) للموظف
      await addDoc(collection(dbInstance, 'notifications'), {
        userId: selectedEmployee.uid,
        type: 'request_assigned',
        requestId: requestId,
        title: 'تنصيب وتعيين مهمة جديدة',
        message: `تم تعيينك كمسؤول ومتابع للطلب رقم (${requestSerialNumber || requestId})`,
        read: false,
        createdAt: serverTimestamp()
      });

      // 3. كتابة حدث عام لإطلاق نظام التنبيهات ونظام التراسل
      await createRequestEvent({
        requestId: requestId,
        requestSerialNumber: requestSerialNumber || requestId,
        type: 'request_reactivated', // للتعبير عن إعادة المعالجة وبدء العمل
        message: `تم تكليف الموظف (${selectedEmployee.name}) لمتابعة ومعالجة الطلب.`,
        createdBy: profile?.uid || 'system',
        createdByName: profile?.name || 'المدير العام',
        payload: {
          assignedEmployeeId: selectedEmployee.uid,
          assignedEmployeeName: selectedEmployee.name,
          customRecipients: selectedEmployee.telegramChatId ? [selectedEmployee.telegramChatId] : []
        }
      });

      toast.success(`تم تعيين الموظف ${selectedEmployee.name} بنجاح`);
      
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: any) {
      console.error('Failed to assign employee:', err);
      toast.error('فشل في حفظ التكليف: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-slate-900/60 backdrop-blur-sm" id="assign-employee-modal-overlay">
        
        {/* النقر بالخارج للإغلاق */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-md bg-white dark:bg-slate-950 rounded-2xl shadow-2xl border border-slate-150 dark:border-slate-800/80 max-h-[90vh] overflow-y-auto"
          id="assign-employee-modal-content"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-150 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-indigo-500" />
              <span>👤 تعيين ومتابعة موظف للطلب</span>
            </h3>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleAssign} className="p-6 space-y-4">
            {/* تفاصيل الطلب الحالي */}
            <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 p-3 rounded-xl space-y-1.5">
              <p className="text-[11px] text-slate-400 font-semibold">تفاصيل التكليف الحالي</p>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 flex justify-between">
                <span>رقم الطلب:</span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400">{requestSerialNumber}</span>
              </p>
              <p className="text-xs text-slate-800 dark:text-slate-100 flex justify-between">
                <span>الموظف المكلف حالياً:</span>
                <span className="font-semibold text-rose-600 dark:text-rose-400">
                  {currentEmployeeName || 'لم يتم التعيين بعد ⚠️'}
                </span>
              </p>
            </div>

            {/* سحب واختيار الموظف */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                اختر الموظف المسؤول عن المعالجة والإفادات
              </label>

              {loading ? (
                <div className="py-2.5 flex items-center gap-2 text-xs text-slate-400 animate-pulse">
                  <span className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></span>
                  <span>جاري تحميل بيانات وقوائم الكادر...</span>
                </div>
              ) : error ? (
                <div className="p-2.5 bg-rose-50 text-rose-600 text-[11px] rounded border border-rose-100 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <select
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    className="w-full text-xs p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                    required
                  >
                    <option value="">-- اختر موظف من السلسلة --</option>
                    {employees.map((emp) => (
                      <option key={emp.uid} value={emp.uid}>
                        👤 {emp.name} | الطلبات النشطة: ({emp.activeRequestsCount}) {emp.uid === currentEmployeeId ? ' [المعين حالياً]' : ''}
                      </option>
                    ))}
                  </select>

                  {/* تلميح ذكي */}
                  <div className="bg-indigo-50/30 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/30 p-2.5 rounded-xl flex items-start gap-2">
                    <Info className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                    <p className="text-[10px] text-indigo-700 dark:text-indigo-400 leading-normal">
                      يتم ترتيب الموظفين تلقائياً من الأقل عبئاً إلى الأكثر عبئاً لضمان التوزيع العادل للمهمات والطلبات القانونية والشركاتية.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* الأزرار */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800/80">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl cursor-pointer"
              >
                إلغاء الأمر
              </button>
              
              <button
                type="submit"
                disabled={isSaving || loading}
                className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>جاري التعيين...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>تعيين وتكليف</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
export default AssignEmployeeModal;
