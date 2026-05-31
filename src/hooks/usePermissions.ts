import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { usePermissionsStore, DEFAULT_ROLE_PERMISSIONS } from '../store/permissionsStore';
import { UserRole } from '../types/user';
import { canViewField, canPerformAction } from '../utils/permissions';
import { VisibilityType } from '../types/permissions';

/**
 * هووك مخصص (Custom Hook) عالي الأداء لتسهيل التحقق من صلاحيات العرض والإجراءات
 * للمستند الحالي أو المستخدم الحالي بشكل ديناميكي وفي الزمن الفعلي.
 */
export function usePermissions() {
  const { profile } = useAuth();
  const role = (profile?.role || 'employee') as UserRole;
  
  const { permissions, loading, initStoreListener } = usePermissionsStore();

  // تفعيل المستمع اللحظي للتعديلات فور تصفح التطبيق
  useEffect(() => {
    const unsubscribe = initStoreListener();
    return () => unsubscribe();
  }, [initStoreListener]);

  // الحصول على صلاحيات الموظف أو المستخدم الحالي بناءً على دوره
  const currentPermissions = (permissions && permissions[role]) 
    ? permissions[role] 
    : DEFAULT_ROLE_PERMISSIONS[role];

  /**
   * فحص مستوى رؤية حقل معين
   * @param fieldKey اسم الحقل (مثال: 'nationalId', 'financialAmounts')
   * @returns 'full' | 'masked' | 'hidden'
   */
  const getFieldVisibility = (fieldKey: keyof typeof currentPermissions.fields): VisibilityType => {
    if (!currentPermissions) {
      // احتياط في حال عدم التحميل بعد
      return DEFAULT_ROLE_PERMISSIONS[role].fields[fieldKey] || 'hidden';
    }
    return currentPermissions.fields[fieldKey];
  };

  /**
   * استرجاع القيمة المعالجة المناسبة للعرض بناءً على مستوى خصوصية وصلاحيات الدور العارض
   * @param fieldKey مفتاح الحقل المراد فلترته (مثل: 'nationalId' أو 'financialAmounts')
   * @param value القيمة المراد عرضها في حال سُمح للمستخدم بذلك
   * @returns القيمة الأصلية، مشفرة، أو قناع إخفاء كامل للخصوصية
   */
  const viewField = <T>(
    fieldKey: keyof typeof currentPermissions.fields, 
    value: T
  ): T | string => {
    const visibility = getFieldVisibility(fieldKey);
    const isNationalId = fieldKey === 'nationalId';
    return canViewField(visibility, value, isNationalId);
  };

  /**
   * فحص ما إذا كان للمستخدم الحالي صلاحية القيام بإجراء محدد
   * @param actionKey اسم الإجراء (مثال: 'createRequest', 'deleteRequest')
   * @returns boolean هل هو مصرح به أم غير مصرح به
   */
  const canDo = (actionKey: keyof typeof currentPermissions.actions): boolean => {
    // الأدمن يملك صلاحيات كاملة دوماً لدوافع إدارية وصيانة
    if (role === 'admin') return true;

    if (!currentPermissions) {
      return canPerformAction(DEFAULT_ROLE_PERMISSIONS[role].actions[actionKey], false);
    }
    return canPerformAction(currentPermissions.actions[actionKey], false);
  };

  return {
    role,
    userLabel: currentPermissions?.label || 'موظف',
    currentPermissions,
    loading: loading && !permissions, // جاري التحميل في حال عدم توفر كاش محلي
    getFieldVisibility,
    viewField,
    canDo,
  };
}

/**
 * أمثلة استخدام الهووك في الواجهة المخصصة:
 * 
 * 1. لإخفاء زري الإنشاء والتعديل:
 *    const { canDo } = usePermissions();
 *    {canDo('createRequest') && <button>إنشاء طلب جديد</button>}
 * 
 * 2. لعرض حقل المبالغ بشكل آمن ومحمي:
 *    const { viewField } = usePermissions();
 *    <span>المبلغ: {viewField('financialAmounts', caseDetail.amount)}</span>
 * 
 * 3. لعرض رقم الهوية الوطنية مشفر أو كامل:
 *    const { viewField } = usePermissions();
 *    <span>رقم الهوية: {viewField('nationalId', caseDetail.idNumber)}</span>
 */
