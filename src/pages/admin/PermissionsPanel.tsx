import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Navigate, useNavigate } from 'react-router-dom';
import { usePermissionsStore, DEFAULT_ROLE_PERMISSIONS } from '../../store/permissionsStore';
import { UserRole } from '../../types/user';
import { RolePermissions, VisibilityType } from '../../types/permissions';
import RoleSelector from '../../components/admin/RoleSelector';
import FieldPermissions from '../../components/admin/FieldPermissions';
import ActionPermissions from '../../components/admin/ActionPermissions';
import { 
  ShieldAlert, 
  Save, 
  RotateCcw, 
  ArrowRight, 
  Lock, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Loader2,
  XCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function PermissionsPanel() {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // الحصول على قيم متجر الصلاحيات الديناميكي
  const { 
    permissions, 
    loading: storeLoading, 
    initStoreListener, 
    saveRolePermissions, 
    resetToDefaults 
  } = usePermissionsStore();

  // الحالة المحلية للتحكم وتتبع التعديلات (Draft)
  const [selectedRole, setSelectedRole] = useState<UserRole>('sales_employee');
  const [fieldsDraft, setFieldsDraft] = useState<RolePermissions['fields'] | null>(null);
  const [actionsDraft, setActionsDraft] = useState<RolePermissions['actions'] | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // حوارات التأكيد المخصصة
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const [pendingRoleChange, setPendingRoleChange] = useState<UserRole | null>(null);

  // بدء مستمع الصلاحيات بالزمن الفعلي
  useEffect(() => {
    const unsubscribe = initStoreListener();
    return () => unsubscribe();
  }, [initStoreListener]);

  // تحديث المسودة (Draft) عند تغيير الدور أو تغيير البيانات في قاعدة البيانات
  useEffect(() => {
    if (!permissions) return;
    
    const rolePermissions = permissions[selectedRole] || DEFAULT_ROLE_PERMISSIONS[selectedRole];
    
    if (rolePermissions) {
      setFieldsDraft({ ...rolePermissions.fields });
      setActionsDraft({ ...rolePermissions.actions });
    }
    setIsDirty(false);
  }, [selectedRole, permissions]);

  // حماية الصفحة: إذا لم تكن أدمن، قم بتحويل المستخدم لصفحة لوحة التحكم
  if (!authLoading && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  // حالة التحميل الأولية للهوية أو المتجر
  if (authLoading || (storeLoading && !permissions)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-6" dir="rtl">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
        <h3 className="text-lg font-black text-slate-700 dark:text-slate-300 mt-4">جاري تحميل لوحة التحكم والصلاحيات...</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">برجاء الانتظار قليلاً لتثبيت الحماية والتجهيز.</p>
      </div>
    );
  }

  // تتبع تعديلات حقول العرض
  const handleFieldChange = (fieldKey: keyof RolePermissions['fields'], value: VisibilityType) => {
    if (!fieldsDraft) return;
    const updated = { ...fieldsDraft, [fieldKey]: value };
    setFieldsDraft(updated);
    setIsDirty(true);
  };

  // تتبع تعديلات حقول الإجراءات
  const handleActionChange = (actionKey: keyof RolePermissions['actions'], value: boolean) => {
    if (!actionsDraft) return;
    const updated = { ...actionsDraft, [actionKey]: value };
    setActionsDraft(updated);
    setIsDirty(true);
  };

  // معالجة تغيير الدور مع التنبيه للتغييرات غير المحفوظة
  const handleRoleSelection = (role: UserRole) => {
    if (isDirty) {
      setPendingRoleChange(role);
      setShowUnsavedConfirm(true);
    } else {
      setSelectedRole(role);
    }
  };

  // حفظ التغيرات في السيرفر لـ Firestore
  const handleSaveChanges = async () => {
    if (!fieldsDraft || !actionsDraft || !permissions) return;
    
    setIsSaving(true);
    const savePromise = async () => {
      const currentRoleData = permissions[selectedRole] || DEFAULT_ROLE_PERMISSIONS[selectedRole];
      const updatedData: RolePermissions = {
        ...currentRoleData,
        fields: fieldsDraft,
        actions: actionsDraft,
      };

      await saveRolePermissions(selectedRole, updatedData);
      setIsDirty(false);
    };

    toast.promise(
      savePromise(),
      {
        loading: 'جاري حفظ التغييرات على السيرفر...',
        success: 'تم حفظ الصلاحيات وشعار الأمان بنجاح! ✓',
        error: 'عذراً، حدث خطأ أثناء الحفظ. يرجى التحقق من القواعد.',
      },
      {
        style: {
          fontWeight: 'bold',
          fontSize: '14px',
          fontFamily: 'sans-serif',
        },
        success: {
          duration: 4000,
          icon: '🛡️',
        }
      }
    ).finally(() => {
      setIsSaving(false);
    });
  };

  // استعادة القيم الافتراضية للدور بعد التأكيد
  const handleConfirmReset = async () => {
    setIsResetting(true);
    setShowResetConfirm(false);

    try {
      await resetToDefaults(selectedRole);
      toast.success('تمت استعادة الصلاحيات الافتراضية للدور بنجاح!', {
        icon: '🔄',
        style: { fontWeight: 'bold' }
      });
      setIsDirty(false);
    } catch (err) {
      toast.error('فشلت محاولة استعادة الصلاحيات الافتراضية.');
    } finally {
      setIsResetting(false);
    }
  };

  const currentRoleRawValue = permissions?.[selectedRole] || DEFAULT_ROLE_PERMISSIONS[selectedRole];
  
  let formattedDate = 'غير متوفر (افتراضي)';
  if (currentRoleRawValue?.updatedAt) {
    const ts = currentRoleRawValue.updatedAt;
    let d: Date | null = null;
    if (typeof ts.toDate === 'function') {
      d = ts.toDate();
    } else if (typeof ts.seconds === 'number') {
      d = new Date(ts.seconds * 1000);
    } else if (typeof ts._seconds === 'number') {
      d = new Date(ts._seconds * 1000);
    } else {
      const parsed = new Date(ts);
      if (!isNaN(parsed.getTime())) {
        d = parsed;
      }
    }
    if (d) {
      formattedDate = d.toLocaleString('ar-EG', { hour12: true });
    }
  }
  const lastUpdatedText = formattedDate;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20" dir="rtl">
      {/* الهيدر العلوي */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 py-6 px-4 md:px-8 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4 text-right">
            <button
              onClick={() => {
                if (isDirty) {
                  setPendingRoleChange(null);
                  setShowUnsavedConfirm(true);
                } else {
                  navigate(-1);
                }
              }}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-xl transition-all border border-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 dark:text-slate-400 dark:border-slate-800"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-tight">
                  إدارة الصلاحيات والمستويات الأمنية
                </h1>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                لوحة التحكم الديناميكية لتعديل صلاحيات رؤية الحقول والعمليات بقرار فوري من الإدارة العامة لمصنع جدة للدهانات.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-100/60 dark:bg-slate-850 px-4 py-2.5 rounded-2xl w-fit self-start md:self-auto border border-slate-100 dark:border-slate-850">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              آخر تعديل على الدور: <span className="text-indigo-600 dark:text-indigo-400">{lastUpdatedText}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-8 space-y-8">
        
        {/* قسم 1: اختيار الدور */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-850 shadow-sm space-y-4">
          <RoleSelector 
            selectedRole={selectedRole} 
            onChange={handleRoleSelection} 
            disabled={isSaving || isResetting}
          />
        </div>

        {/* تنبيه التعديل الفوري */}
        {isDirty && (
          <div className="p-4 bg-amber-50/70 border border-amber-150 rounded-2xl flex items-center gap-3 text-amber-800 text-xs font-bold animate-pulse dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-400">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" />
            <span>انتباه: هناك تعديلات معلقة لم تُحفظ بعد! يرجى النقر على زر "حفظ التغييرات والشعار" بالأسفل لاعتماد الصلاحيات الجديدة للمستخدمين.</span>
          </div>
        )}

        {/* قسم 2: صلاحيات العرض والإجراءات في عمودين */}
        {fieldsDraft && actionsDraft && (
          <div className="grid grid-cols-1 xl:grid-cols-1 gap-8">
            
            {/* بطاقة حقول الرؤية */}
            <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-100 dark:border-slate-850 shadow-sm space-y-6">
              <FieldPermissions 
                fields={fieldsDraft} 
                onChange={handleFieldChange}
                disabled={isSaving || isResetting}
              />
            </div>

            {/* بطاقة الإجراءات والعمليات */}
            <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-100 dark:border-slate-850 shadow-sm space-y-6">
              <ActionPermissions 
                actions={actionsDraft} 
                onChange={handleActionChange}
                disabled={isSaving || isResetting}
              />
            </div>

          </div>
        )}

        {/* قسم 3: شريط أزرار اتخاذ القرار (Footer Action Bar) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-850 shadow-md">
          <div className="text-right space-y-0.5">
            <span className="text-sm font-black text-slate-800 dark:text-slate-200 block">
              اعتماد إعدادات الأمان
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500 block">
              سيتم تفعيل الصلاحيات وتحديث آليات التجهيز والتشفير فوراً لكافة حسابات هذا الدور.
            </span>
          </div>

          <div className="flex flex-row gap-3 w-full sm:w-auto">
            {/* زر استعادة الافتراضي */}
            <button
              type="button"
              disabled={isSaving || isResetting}
              onClick={() => setShowResetConfirm(true)}
              className="flex-1 sm:flex-none py-3.5 px-6 font-bold text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className={`w-4 h-4 ${isResetting ? 'animate-spin' : ''}`} />
              استعادة الصلاحيات الافتراضية
            </button>

            {/* زر حفظ التعديلات */}
            <button
              type="button"
              disabled={isSaving || isResetting || !isDirty}
              onClick={handleSaveChanges}
              className={`flex-1 sm:flex-none py-3.5 px-8 font-black text-xs text-white rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isDirty 
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:shadow-indigo-500/10 hover:from-indigo-500 hover:to-indigo-600' 
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none'
              }`}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              حفظ وتطبيق التغييرات
            </button>
          </div>
        </div>

      </div>

      {/* حوار تأكيد استعادة الافتراضي */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-950 rounded-3xl max-w-md w-full p-6 border border-slate-100 dark:border-slate-850 shadow-2xl space-y-6 text-right" dir="rtl">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 rounded-2xl">
                <RotateCcw className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">هل تود استعادة الصلاحيات الافتراضية؟</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">هذا الإجراء غير قابل للتراجع.</p>
              </div>
            </div>
            
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              ستتم إزالة جميع الصلاحيات والتغييرات المخصصة حالياً لدور 
              <span className="font-extrabold text-indigo-600 dark:text-indigo-400"> "{DEFAULT_ROLE_PERMISSIONS[selectedRole]?.label}" </span>
              واعتماد مصفوفة الصلاحيات الموصى بها في السيرفر.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-850 dark:text-slate-300 dark:hover:bg-slate-850 font-bold text-xs rounded-xl transition-all"
              >
                تراجع وإلغاء
              </button>
              <button
                onClick={handleConfirmReset}
                className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all"
              >
                تأكيد وبدء الاستعادة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* حوار تأكيد الخروج بدون حفظ */}
      {showUnsavedConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-950 rounded-3xl max-w-md w-full p-6 border border-slate-100 dark:border-slate-850 shadow-2xl space-y-6 text-right" dir="rtl">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 rounded-2xl">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">قد تفقد تعديلات غير محفوظة!</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">هناك تعديلات لم يتم تطبيقها بعد.</p>
              </div>
            </div>
            
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              إذا غادرت دور
              <span className="font-extrabold text-indigo-600 dark:text-indigo-400"> "{DEFAULT_ROLE_PERMISSIONS[selectedRole]?.label}" </span>
              الآن، فستخسر جميع التعديلات والصلاحيات المحلية التي حددتها للتو ولم تُحفظ بـ Firestore.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => {
                  setShowUnsavedConfirm(false);
                  setPendingRoleChange(null);
                }}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-850 dark:text-slate-300 dark:hover:bg-slate-800 font-bold text-xs rounded-xl transition-all"
              >
                البقاء للمتابعة والحفظ
              </button>
              <button
                onClick={() => {
                  setShowUnsavedConfirm(false);
                  setIsDirty(false);
                  if (pendingRoleChange) {
                    setSelectedRole(pendingRoleChange);
                    setPendingRoleChange(null);
                  } else {
                    navigate(-1);
                  }
                }}
                className="flex-1 py-3 px-4 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all"
              >
                تجاهل التعديلات والمغادرة
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
