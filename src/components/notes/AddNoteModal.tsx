import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useEmployees } from '../../hooks/useEmployees';
import { X, Lock, User, Globe, MessageSquare, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';

interface AddNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (noteData: {
    content: string;
    scope: 'internal' | 'employee_targeted' | 'employee_public';
    targetEmployeeId?: string;
    targetEmployeeName?: string;
  }) => Promise<void>;
}

export const AddNoteModal: React.FC<AddNoteModalProps> = ({ isOpen, onClose, onAdd }) => {
  const { profile } = useAuth();
  const { employees, loading: loadingEmployees } = useEmployees();
  
  const [content, setContent] = useState('');
  const [scope, setScope] = useState<'internal' | 'employee_targeted' | 'employee_public'>('employee_public');
  const [targetEmployeeId, setTargetEmployeeId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentUserRole = profile?.role || 'employee';
  const isManagement = ['admin', 'law_manager', 'company_manager', 'company_assistant', 'law_assistant'].includes(currentUserRole);

  // تحديث الخيار الافتراضي المناسب للمستخدمين
  useEffect(() => {
    if (isOpen) {
      setContent('');
      if (isManagement) {
        setScope('internal'); // الإدارة تفضل الداخلية كافتراضي للأمان والقصوى
      } else {
        setScope('employee_public'); // الموظفون لديهم خيار عام فقط
      }
      setTargetEmployeeId('');
    }
  }, [isOpen, isManagement]);

  if (!isOpen) return null;

  // تحديد خيارات نطاق الملاحظات المتاحة لكل دور
  const scopeOptions = isManagement 
    ? [
        { value: 'internal', label: '🔒 ملاحظة داخلية (للإدارة فقط)', desc: 'لا يمكن للموظفين العاديين رؤية هذا النص' },
        { value: 'employee_targeted', label: '👤 موجهة لموظف محدد (أسرار تكليف)', desc: 'تظهر للموظف المستهدف مع الإدارة فقط' },
        { value: 'employee_public', label: '🌐 عامة (لكافة موظفي الطلب)', desc: 'متاحة للجميع للاطلاع الفوري والتكامل' }
      ]
    : [
        { value: 'employee_public', label: '🌐 عامة (لكافة الموظفين)', desc: 'يقوم الموظف برفعها لتصفحها من قبل الإدارة وباقي الزملاء' }
      ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) {
      toast.error('يرجى كتابة نص الملاحظة');
      return;
    }

    if (scope === 'employee_targeted' && !targetEmployeeId) {
      toast.error('يرجى اختيار الموظف المستهدف');
      return;
    }

    setIsSubmitting(true);
    try {
      let targetEmpName = '';
      if (scope === 'employee_targeted') {
        const emp = employees.find(e => e.uid === targetEmployeeId);
        targetEmpName = emp ? emp.name : '';
      }

      await onAdd({
        content: content.trim(),
        scope,
        targetEmployeeId: scope === 'employee_targeted' ? targetEmployeeId : undefined,
        targetEmployeeName: scope === 'employee_targeted' ? targetEmpName : undefined
      });

      toast.success('تمت إضافة الملاحظة بنجاح');
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error('حدث خطأ أثناء حفظ الملاحظة: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-slate-900/60 backdrop-blur-sm" id="add-note-modal-overlay">
        
        {/* الحشية الخارجية للنقر الخلفي للإغلاق */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-lg bg-white dark:bg-slate-950 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800/80 max-h-[90vh] overflow-y-auto"
          id="add-note-modal-content"
        >
          {/* مقطع العنوان والتأصيل الأسري من رتم الفخامة */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-base font-semibold text-slate-950 dark:text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-500" />
              <span>إضافة ملاحظة جديدة للطلب</span>
            </h3>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* خيارات حماية الخصوصية (النطاق/الرؤية) */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                مستوى الخصوصية ورؤية الملاحظة
              </label>
              
              <div className="space-y-2">
                {scopeOptions.map((opt) => (
                  <label
                    key={opt.value}
                    onClick={() => setScope(opt.value as any)}
                    className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 select-none ${
                      scope === opt.value
                        ? 'border-indigo-600 bg-indigo-50/20 dark:bg-indigo-950/20 dark:border-indigo-500'
                        : 'border-slate-100 bg-slate-50/50 dark:bg-slate-900/20 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-750'
                    }`}
                  >
                    <input
                      type="radio"
                      name="noteScope"
                      value={opt.value}
                      checked={scope === opt.value}
                      onChange={() => setScope(opt.value as any)}
                      className="mt-1 h-3.5 w-3.5 text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                    />
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">
                        {opt.label}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        {opt.desc}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* في حال اختيار موجهة لموظف محدد - تفعيل اختيار الموظف المستهدف */}
            <AnimatePresence>
              {scope === 'employee_targeted' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-2 overflow-hidden"
                >
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    اختر الموظف المستهدف لمشاهدة الملاحظة
                  </label>
                  
                  {loadingEmployees ? (
                    <div className="text-xs text-slate-400 animate-pulse py-1">جاري تحميل قائمة الموظفين...</div>
                  ) : (
                    <select
                      value={targetEmployeeId}
                      onChange={(e) => setTargetEmployeeId(e.target.value)}
                      className="w-full text-xs p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    >
                      <option value="">-- اختر موظفاً --</option>
                      {employees.map((emp) => (
                        <option key={emp.uid} value={emp.uid}>
                          👤 {emp.name} | عبء التكليفات: {emp.activeRequestsCount} طلبات نشطة
                        </option>
                      ))}
                    </select>
                  )}
                  
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>سيقوم النظام بإرسال إشعار فوري مباشر للموظف المستهدف لتسهيل المتابعة.</span>
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* صندوق الإدخال النصي */}
            <div className="space-y-2">
              <label htmlFor="noteContent" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                نص الملاحظة
              </label>
              <textarea
                id="noteContent"
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="اكتب ملاحظتك المهنية هنا مع الحفاظ على معايير الجودة والشفافية..."
                className="w-full text-xs p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 dark:text-white shadow-sm"
                required
              />
            </div>

            {/* الأزرار والإجراءات */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800/80">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl transition-all duration-200 cursor-pointer"
              >
                إلغاء الأمر
              </button>
              
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-xl shadow-md hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-200 flex items-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>جاري الحفظ...</span>
                  </>
                ) : (
                  <span>حفظ الملاحظة</span>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
