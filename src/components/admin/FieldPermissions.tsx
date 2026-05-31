import React from 'react';
import { RolePermissions, VisibilityType } from '../../types/permissions';
import { Hash, UserCheck, CreditCard, Banknote, Paperclip, CalendarDays, Eye, EyeOff, ShieldAlert } from 'lucide-react';

interface FieldPermissionsProps {
  fields: RolePermissions['fields'];
  onChange: (fieldKey: keyof RolePermissions['fields'], value: VisibilityType) => void;
  disabled?: boolean;
}

interface FieldConfig {
  key: keyof RolePermissions['fields'];
  label: string;
  description: string;
  icon: React.ReactNode;
}

export default function FieldPermissions({ fields, onChange, disabled = false }: FieldPermissionsProps) {
  const fieldsConfig: FieldConfig[] = [
    {
      key: 'serialNumber',
      label: 'رقم الطلب (السيريال)',
      description: 'الرقم المرجعي التسلسلي للحقيبة القضائية أو طلب التنفيذ.',
      icon: <Hash className="w-5 h-5" />,
    },
    {
      key: 'clientName',
      label: 'اسم العميل / المنشأة',
      description: 'الاسم الكامل أو التجاري للأطراف ذات العلاقة بالمعاملة.',
      icon: <UserCheck className="w-5 h-5" />,
    },
    {
      key: 'nationalId',
      label: 'رقم الهوية / الإقامة',
      description: 'رقم الهوية الكامل، أو تشفيرها وإظهار آخر 4 أرقام فقط للحماية.',
      icon: <CreditCard className="w-5 h-5" />,
    },
    {
      key: 'financialAmounts',
      label: 'المبالغ المالية والرسوم',
      description: 'رؤية مبالغ السند وقرارات الصرف والمستحقات المباشرة.',
      icon: <Banknote className="w-5 h-5" />,
    },
    {
      key: 'attachments',
      label: 'المرفقات والقرارات المرفوعة',
      description: 'الاطلاع على السند المالي المرفوع والتحميل والمستندات المساندة.',
      icon: <Paperclip className="w-5 h-5" />,
    },
    {
      key: 'sessionsInfo',
      label: 'تفاصيل ومواعيد الجلسات',
      description: 'عرض بيانات المواعيد وتقارير محاضر الجلسات القانونية وتفاصيلها.',
      icon: <CalendarDays className="w-5 h-5" />,
    },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      <div className="border-b border-slate-100 dark:border-slate-800 pb-4 text-right">
        <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-200">
          ⚙️ صلاحيات العرض وإمكانية رؤية البيانات (Field Visibility)
        </h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          حدد مدى إمكانية رؤية هذا الدور للتفاصيل الحساسة في الطلبات والتقارير المالية.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fieldsConfig.map((field) => {
          const currentValue = fields[field.key] || 'full';
          
          return (
            <div 
              key={field.key}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 hover:shadow-md transition-all duration-300 flex flex-col justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl ${
                  currentValue === 'full' 
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400' 
                    : currentValue === 'masked' 
                    ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400' 
                    : 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400'
                }`}>
                  {field.icon}
                </div>
                
                <div className="space-y-1 text-right flex-1">
                  <h4 className="text-sm font-black text-slate-800 dark:text-slate-200">
                    {field.label}
                  </h4>
                  <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
                    {field.description}
                  </p>
                </div>
              </div>

              {/* اختيار مستوى رؤية الحقل */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">مستوى الرؤية:</label>
                <div className="relative flex-1">
                  <select
                    disabled={disabled}
                    value={currentValue}
                    onChange={(e) => onChange(field.key, e.target.value as VisibilityType)}
                    className={`w-full text-right font-black text-xs px-3.5 py-2 rounded-xl border focus:outline-none focus:ring-2 cursor-pointer transition-all duration-300 ${
                      currentValue === 'full'
                        ? 'bg-emerald-50/50 border-emerald-100 text-emerald-700 focus:ring-emerald-500/20 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400'
                        : currentValue === 'masked'
                        ? 'bg-indigo-50/50 border-indigo-100 text-indigo-700 focus:ring-indigo-500/20 dark:bg-indigo-950/20 dark:border-indigo-900/30 dark:text-indigo-400'
                        : 'bg-rose-50/50 border-rose-100 text-rose-700 focus:ring-rose-500/20 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400'
                    }`}
                  >
                    <option value="full" className="font-bold text-emerald-600">
                      👁️ كامل (Full Visibility)
                    </option>
                    <option value="masked" className="font-bold text-indigo-600">
                      🔒 مشفر جزئياً (Masked/Masked 4)
                    </option>
                    <option value="hidden" className="font-bold text-rose-600">
                      🚫 مخفي تماماً (Hidden)
                    </option>
                  </select>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
