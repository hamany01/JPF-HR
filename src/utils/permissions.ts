import { VisibilityType } from '../types/permissions';

/**
 * دالة لتشفير رقم الهوية الوطنية أو رقم الإقامة لإخفاء الأرقام الحساسة
 * وإظهار آخر 4 أرقام فقط لضمان الخصوصية وسرية البيانات.
 * 
 * @param nationalId رقم الهوية الكامل (سواء كان 10 أرقام أو غير ذلك)
 * @returns رقم الهوية المشفر (مثال: ******7890)
 */
export function maskNationalId(nationalId?: string): string {
  if (!nationalId) return '';
  const trimmed = nationalId.trim();
  if (trimmed.length <= 4) return trimmed;
  
  const lastFour = trimmed.slice(-4);
  const maskedSection = '*'.repeat(trimmed.length - 4);
  return `${maskedSection}${lastFour}`;
}

/**
 * دالة تفحص ما إذا كان يمكن عرض قيمة حقل معين بناءً على نوع الصلاحية (رؤية كاملة، مشفرة، أو مخفية)
 * 
 * @param visibility مستوى الصلاحية للحقل ('full' | 'masked' | 'hidden')
 * @param value القيمة الفعلية المراد فحصها وعرضها
 * @param isNationalId هل الحقل هو حقل الهوية الوطنية (لتطبيق التشفير المخصص إذا كانت الصلاحية masked)
 * @returns القيمة المعالجة المناسبة للعرض في الحالتين (قيمة كاملة، مشفرة، أو نص معبر عن الإخفاء)
 */
export function canViewField<T>(
  visibility: VisibilityType, 
  value: T, 
  isNationalId: boolean = false
): T | string {
  try {
    if (visibility === 'hidden') {
      return '••••••'; // تم إخفاء الحقل بقرار من الإدارة
    }
    
    if (visibility === 'masked' && isNationalId && typeof value === 'string') {
      return maskNationalId(value);
    }
    
    if (visibility === 'masked' && !isNationalId) {
      // حقول أخرى كالحسابات المالية والمبالغ عند تشفيرها
      if (typeof value === 'number') {
        return '***,**';
      }
      return '••••••';
    }
    
    return value;
  } catch (error) {
    console.error("Error evaluating canViewField for value:", value, error);
    return '••••••';
  }
}

/**
 * دالة فحص ما إذا كان الدور الحالي مصرحاً له بالقيام بإجراء معين
 * 
 * @param allowed هل هذا الإجراء مسموح بالأساس في نموذج الصلاحيات المخصصة
 * @param fallbackValue القيمة الاحتياطية الافتراضية في حال تعذر الوصول للصلاحية
 * @returns القيمة النهائية (true أو false)
 */
export function canPerformAction(
  allowed?: boolean, 
  fallbackValue: boolean = false
): boolean {
  if (allowed === undefined) return fallbackValue;
  return allowed;
}
