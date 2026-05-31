import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';
import NotesSystem from '../../components/notes/NotesSystem';
import AssignEmployeeModal from '../../components/admin/AssignEmployeeModal';
import { usePermissions } from '../../hooks/usePermissions';
import { 
  ArrowRight, 
  Hash, 
  User, 
  CreditCard, 
  BadgeDollarSign, 
  CalendarDays, 
  Paperclip, 
  ShieldAlert,
  Loader2, 
  Clock, 
  Building, 
  Printer, 
  Lock, 
  CheckCircle,
  MessageSquare,
  Plus
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function RequestDetailsEmployee() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { viewField, getFieldVisibility, canDo } = usePermissions();

  const [request, setRequest] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  // الحصول على مستويات رؤية الحقول الفرعية
  const serialNoVisibility = getFieldVisibility('serialNumber');
  const clientNameVisibility = getFieldVisibility('clientName');
  const nationalIdVisibility = getFieldVisibility('nationalId');
  const financialVisibility = getFieldVisibility('financialAmounts');
  const attachmentsVisibility = getFieldVisibility('attachments');
  const sessionsVisibility = getFieldVisibility('sessionsInfo');

  // جلب بيانات المعاملة في الزمن الفعلي
  useEffect(() => {
    if (!id) return;
    setLoading(true);

    const docRef = doc(db, 'requests', id);
    const unsubscribeRequest = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setRequest({ id: snapshot.id, ...snapshot.data() });
          setError(null);
        } else {
          setError('المعاملة المطلوبة غير موجودة أو تم حذفها.');
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching request details:', err);
        setError('حدث خطأ أثناء الاتصال بقاعدة البيانات.');
        setLoading(false);
      }
    );

    return () => {
      unsubscribeRequest();
    };
  }, [id]);

  // التحقق من الأمان: هل المعاملة مسندة لهذا الموظف؟ (الأدمن مستثنى من القيود للأغراض الإدارية)
  const isAssignedToMe = request?.assignedEmployeeId === profile?.uid;
  const isManagerOrAdmin = ['admin', 'law_manager', 'company_manager'].includes(profile?.role || '');
  const hasAccessPermission = isAssignedToMe || isManagerOrAdmin;

  const formatCurrency = (val: number) => {
    if (!val && val !== 0) return '-';
    return val.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-6" dir="rtl">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
        <h3 className="text-lg font-black text-slate-700 dark:text-slate-300 mt-4">جاري تأمين الحقول ومطابقة البيانات...</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">نهتم بأمان وسرية بيانات العمل والعملاء.</p>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 text-right" dir="rtl">
        <div className="bg-white dark:bg-slate-900 border border-slate-150 p-8 rounded-3xl max-w-md w-full shadow-lg space-y-4">
          <div className="p-3 bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 rounded-2xl w-fit">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">حدث خطأ ما</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{error || 'المستند غير متاح حالياً.'}</p>
          <button
            onClick={() => navigate(-1)}
            className="w-full py-3 bg-slate-900 hover:bg-slate-805 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            العودة لجلسة العمل
          </button>
        </div>
      </div>
    );
  }

  // إذا كانت القطعة مسندة لشخص آخر والموظف عادي، يتم جلب سياج المنع
  if (!hasAccessPermission) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 text-right" dir="rtl">
        <div className="bg-white dark:bg-slate-900 border border-red-100 dark:border-red-950 p-8 rounded-3xl max-w-lg w-full shadow-2xl space-y-6">
          <div className="p-3 bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 rounded-2xl w-fit">
            <Lock className="w-8 h-8 animate-pulse" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-black text-slate-900 dark:text-white">تحذير أمان: هذا الطلب ليس مسنداً إليك!</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-bold">رقم السلسلة القضائية: {request.requestSerialNumber || request.id}</p>
          </div>
          
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            تم تشفير وضبط هذا الملف لمنع تصفحه من قبل الموظفين غير المكلفين به بشكل فوري ومباشر. للتعديلات أو استلام المهام، يرجى تزويد حسابك بطلب التكليف المناسب من قبل الأدمن.
          </p>
          
          <button
            onClick={() => navigate('/')}
            className="w-full py-3.5 bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-red-500/10 transition-all cursor-pointer"
          >
            العودة للرئيسية الآمنة
          </button>
        </div>
      </div>
    );
  }

  const getStatusLabelText = (status: string) => {
    return {
      pending: 'قيد المراجعة الإدارية',
      approved_preliminary: 'معتمد مبدئياً',
      approved: 'مكتمل ومعتمد',
      rejected: 'مرفوض إدارياً',
      converted_to_case: 'مُحوّل إلى قضية رسمية',
    }[status] || status;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 text-right" dir="rtl">
      {/* الهيدر العلوي */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 py-6 px-4 md:px-8 shadow-sm">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-xl transition-all border border-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 dark:text-slate-400 dark:border-slate-800"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <div className="space-y-1">
              <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 px-2.5 py-1 rounded-md">
                معاملة مسندة إليك
              </span>
              <h1 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                تفاصيل المعاملة: {serialNoVisibility !== 'hidden' ? viewField('serialNumber', request.requestSerialNumber) : 'REQ-*****'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {canDo('assignEmployee') && (
              <button
                onClick={() => setShowAssignModal(true)}
                className="px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all duration-200 flex items-center gap-1.5 shadow-sm hover:shadow-md cursor-pointer select-none"
              >
                <span>👤 {request.assignedEmployeeId ? 'تغيير الموظف المكلف' : 'تعيين موظف للطلب'}</span>
              </button>
            )}
            
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black ${
              request.status === 'pending'
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-100'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100'
            }`}>
              {getStatusLabelText(request.status)}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-8 space-y-8">
        
        {/* معلومات أساسية */}
        <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-100 dark:border-slate-850 shadow-sm space-y-6">
          <div className="border-b border-slate-50 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Building className="w-4 h-4 text-indigo-600" />
              <span>المعلومات القضائية للعميل والأطراف</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 block">رقم المعاملة الفرعي:</span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block font-mono">
                {serialNoVisibility !== 'hidden' ? viewField('serialNumber', request.requestSerialNumber) : 'محظور'}
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 block">اسم المنفذ ضده:</span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                {request.defendantName || 'غير متوفر'}
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 block">اسم العميل:</span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                {clientNameVisibility !== 'hidden' ? viewField('clientName', request.clientName) : 'محجوب للخصوصية'}
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 block">رقم هوية / منشأة العميل:</span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block font-mono">
                {nationalIdVisibility !== 'hidden' ? viewField('nationalId', request.clientId || request.nationalId) : 'محجوب للخصوصية'}
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 block">الموظف المكلف والمتابع للطلب:</span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                👤 {request.assignedEmployeeName || 'لم يتم تعيين أي موظف حتى الآن ⚠️'}
              </span>
            </div>
          </div>
        </div>

        {/* الكتل الممنوعة أو المعالجة حسب الأدوار */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* الكتلة المالية */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-850 shadow-sm space-y-4">
            <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-50 dark:border-slate-800 pb-2">
              💰 تفاصيل ومبالغ السند المالي
            </h4>
            
            {financialVisibility !== 'hidden' ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-50 dark:border-slate-850">
                  <span className="text-xs font-bold text-slate-500">المبلغ المطالب به:</span>
                  <span className="text-xs font-black text-slate-800 dark:text-white font-mono">
                    {financialVisibility === 'masked' ? '***,*** ر.س' : formatCurrency(request.claimAmount)}
                  </span>
                </div>
                {request.promissoryNoteAmount && (
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-50 dark:border-slate-850">
                    <span className="text-xs font-bold text-slate-500">مجموع السند لأمر:</span>
                    <span className="text-xs font-black text-slate-800 dark:text-white font-mono">
                      {financialVisibility === 'masked' ? '***,*** ر.س' : formatCurrency(request.promissoryNoteAmount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-xs font-bold text-slate-500">حالة المستحقات:</span>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-md">
                    مستحقة الفرز
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-6 flex flex-col justify-center items-center text-center space-y-2 bg-rose-50/20 dark:bg-rose-950/5 rounded-2xl border border-dashed border-rose-100 dark:border-rose-950">
                <Lock className="w-7 h-7 text-rose-400" />
                <p className="text-xs font-black text-rose-800 dark:text-rose-400">القيمة المالية مخفية تماماً</p>
                <span className="text-[10px] text-slate-400 leading-tight">ليس لديك صلاحية تصفح المبالغ المالية.</span>
              </div>
            )}
          </div>

          {/* الكتلة الإدارية */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-850 shadow-sm space-y-4">
            <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-50 dark:border-slate-800 pb-2">
              📅 منصة التوريد والأولوية
            </h4>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-50 dark:border-slate-850">
                <span className="text-xs font-bold text-slate-500">المنصة الموردة:</span>
                <span className="text-xs font-black text-slate-705 dark:text-slate-300">
                  {request.platform || 'ناجز التنفيذ'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-50 dark:border-slate-850">
                <span className="text-xs font-bold text-slate-500">نوع المعاملة:</span>
                <span className="text-xs font-black text-slate-705 dark:text-slate-300">
                  {request.transactionType || 'أمر تنفيذ مالي'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-xs font-bold text-slate-500">طريقة الدفع للمطالبة:</span>
                <span className="text-xs font-black text-slate-705 dark:text-slate-300">
                  تحويل سداد رقمي
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* المرفقات ومستندات السند - خاضعة للصلاحية */}
        <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-100 dark:border-slate-850 shadow-sm space-y-4">
          <div className="border-b border-slate-50 dark:border-slate-800 pb-3 flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Paperclip className="w-5 h-5 text-indigo-500" />
              <span>المستندات والمرفقات القانونية المضافة</span>
            </h3>
          </div>

          {attachmentsVisibility !== 'hidden' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {request.attachments && request.attachments.length > 0 ? (
                request.attachments.map((file: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-100/50 dark:border-slate-800/80">
                    <div className="space-y-0.5">
                      <span className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                        {file.customLabel || `مرفق مالي - ${index + 1}`}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono uppercase block">{file.type || 'PDF/JPEG'}</span>
                    </div>
                    
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      referrerPolicy="no-referrer"
                      className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 text-[10px] font-black rounded-lg transition-colors cursor-pointer"
                    >
                      تنزيل ومراجعة
                    </a>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-8 text-center text-xs font-bold text-slate-400">
                  لم يتم رفع أي مستندات أو مرفقات بهذا السند حتى الآن.
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 flex flex-col justify-center items-center text-center space-y-2 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-150 border-dashed">
              <Lock className="w-8 h-8 text-slate-350" />
              <p className="text-xs font-black text-slate-600 dark:text-slate-400">مرفقات السند محجوبة وحساسة للسرية</p>
              <span className="text-[10px] text-slate-400 leading-tight">ليس لديك صلاحية تصفح الملحقات المرفوعة.</span>
            </div>
          )}
        </div>

        {/* نظام الملاحظات المتقدم وحماية الخصوصية */}
        <div className="mt-8">
          <NotesSystem requestId={id!} requestSerialNumber={request.requestSerialNumber || request.id} />
        </div>

      </div>

      {/* مودال تعيين الموظف المسؤول المسؤول */}
      <AssignEmployeeModal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        requestId={request.id}
        requestSerialNumber={request.requestSerialNumber || request.id}
        currentEmployeeId={request.assignedEmployeeId}
        currentEmployeeName={request.assignedEmployeeName}
      />
    </div>
  );
}
