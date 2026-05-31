import React from 'react';
import { UserRole } from '../../types/user';
import { Shield, Scale, Landmark, Building, FileText, User } from 'lucide-react';

interface RoleSelectorProps {
  selectedRole: UserRole;
  onChange: (role: UserRole) => void;
  disabled?: boolean;
}

interface RoleOption {
  value: UserRole;
  label: string;
  description: string;
  icon: React.ReactNode;
  colorClass: string;
}

export default function RoleSelector({ selectedRole, onChange, disabled = false }: RoleSelectorProps) {
  const roles: RoleOption[] = [
    {
      value: 'admin',
      label: 'المدير العام (الأدمن)',
      description: 'يملك كامل الصلاحيات الإدارية والتقنية وتغيير الصلاحيات الأخرى.',
      icon: <Shield className="w-5 h-5" />,
      colorClass: 'from-amber-500 to-orange-600',
    },
    {
      value: 'law_manager',
      label: 'المحامي العام (مدير الشؤون القانونية)',
      description: 'يدير القضايا، الجلسات والملفات القانونية ويوزع المهام على فريقه.',
      icon: <Scale className="w-5 h-5" />,
      colorClass: 'from-blue-500 to-indigo-600',
    },
    {
      value: 'law_assistant',
      label: 'مساعد شؤون قانونية',
      description: 'صلاحيات مساندة لإدخال ومراجعة الجلسات والقضايا العادية.',
      icon: <Landmark className="w-5 h-5" />,
      colorClass: 'from-cyan-500 to-blue-600',
    },
    {
      value: 'company_manager',
      label: 'مدير الشركة (صاحب العمل)',
      description: 'متابعة الطلبات المُنشأة وحالات القضايا والتقارير المالية للشركة.',
      icon: <Building className="w-5 h-5" />,
      colorClass: 'from-emerald-500 to-teal-600',
    },
    {
      value: 'company_assistant',
      label: 'مساعد الشركة',
      description: 'إدخال ومتابعة معاملات الشركة وإعداد التقارير الأولية بصلاحيات غير مالية.',
      icon: <FileText className="w-5 h-5" />,
      colorClass: 'from-purple-500 to-indigo-600',
    },
    {
      value: 'employee',
      label: 'موظف (صلاحيات محدودة)',
      description: 'عرض ومتابعة المعاملات والطلبات المكلف بها شخصياً فقط مع إخفاء المبالغ المالية.',
      icon: <User className="w-5 h-5" />,
      colorClass: 'from-slate-500 to-slate-700',
    },
  ];

  const currentRoleInfo = roles.find((r) => r.value === selectedRole) || roles[roles.length - 1];

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-col gap-1.5 text-right">
        <label className="text-base font-black text-slate-800 dark:text-slate-200">
          اختر الدور المُراد تعديل صلاحياته:
        </label>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          تعديل الصلاحيات هنا سيطبّق فورا على جميع المستخدمين الذين يحملون هذا الدور
        </p>
      </div>

      {/* الـ Select الأساسي المتجاوب للهواتف */}
      <div className="block lg:hidden">
        <select
          disabled={disabled}
          value={selectedRole}
          onChange={(e) => onChange(e.target.value as UserRole)}
          className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
        >
          {roles.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {/* عرض مصف متميز كارد للأدوار للشاشات الكبيرة */}
      <div className="hidden lg:grid grid-cols-2 xl:grid-cols-3 gap-4">
        {roles.map((r) => {
          const isSelected = r.value === selectedRole;
          return (
            <button
              key={r.value}
              disabled={disabled}
              onClick={() => onChange(r.value)}
              className={`group relative text-right p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-sm ${
                isSelected
                  ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 border-slate-900 text-white dark:from-slate-950 dark:to-indigo-950/40 ring-2 ring-indigo-500/20 shadow-md ring-offset-2'
                  : 'bg-white hover:bg-slate-50 border-slate-100 text-slate-700 dark:bg-slate-900 dark:hover:bg-slate-850 dark:border-slate-800 dark:text-slate-300'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {/* أيقونة خلفية مظهر جمالي */}
              {isSelected && (
                <div className="absolute -left-6 -bottom-6 opacity-10 text-white text-9xl transform -rotate-12 pointer-events-none">
                  {r.icon}
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl text-white bg-gradient-to-r ${r.colorClass}`}>
                    {r.icon}
                  </div>
                  <h3 className={`font-black text-sm ${isSelected ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>
                    {r.label}
                  </h3>
                </div>
                <p className={`text-xs leading-relaxed font-medium ${isSelected ? 'text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>
                  {r.description}
                </p>
              </div>

              {isSelected && (
                <div className="mt-4 flex items-center justify-end gap-1.5 self-end">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  <span className="text-[10px] font-bold text-indigo-300">قيد التعديل الآن</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
