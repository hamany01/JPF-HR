import React from 'react';
import { RolePermissions } from '../../types/permissions';
import PermissionToggle from './PermissionToggle';
import { PlusCircle, Edit3, Trash2, MessageSquarePlus, MessageSquareCode } from 'lucide-react';

interface ActionPermissionsProps {
  actions: RolePermissions['actions'];
  onChange: (actionKey: keyof RolePermissions['actions'], value: boolean) => void;
  disabled?: boolean;
}

interface ActionConfig {
  key: keyof RolePermissions['actions'];
  label: string;
  description: string;
  icon: React.ReactNode;
}

export default function ActionPermissions({ actions, onChange, disabled = false }: ActionPermissionsProps) {
  const actionsConfig: ActionConfig[] = [
    {
      key: 'createRequest',
      label: 'إنشاء معاملات جديدة',
      description: 'تقديم طلب مالي أو مطالبة سداد إلكترونية أو ورقية جديدة ونشرها للمراجعة.',
      icon: <PlusCircle className="w-5 h-5" />,
    },
    {
      key: 'editRequest',
      label: 'تعديل المعاملة والطلب القانوني',
      description: 'إجراء تعديلات على بيانات المدعى عليه والتفاصيل الإدارية والأولوية طوال فترة المعاملة.',
      icon: <Edit3 className="w-5 h-5" />,
    },
    {
      key: 'deleteRequest',
      label: 'حذف المعاملات والطلبات',
      description: 'حذف كامل للملف مع المرفقات من السيرفر بشكل مباشر (صلاحية حساسة وخطيرة).',
      icon: <Trash2 className="w-5 h-5" />,
    },
    {
      key: 'addNote',
      label: 'إضافة التعليقات والملاحظات',
      description: 'تمكين كتابة الملاحظات العامة، الملاحظات الموجهة وتحديث المستجدات الإدارية.',
      icon: <MessageSquarePlus className="w-5 h-5" />,
    },
    {
      key: 'deleteNote',
      label: 'حذف وإلغاء الملاحظات',
      description: 'القدرة على مسح التعليقات والملاحظات المدونة مسبقاً من الطلبات بشكل نهائي.',
      icon: <MessageSquareCode className="w-5 h-5" />,
    },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      <div className="border-b border-slate-100 dark:border-slate-800 pb-4 text-right">
        <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-200">
          🛠️ صلاحيات الإجراءات والعمليات التشغيلية (Action Rules)
        </h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          تحكم في العمليات والوظائف التي يُسمح لهذا الدور تنفيذها داخل النظام.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {actionsConfig.map((action) => {
          const checked = actions[action.key] ?? false;
          return (
            <PermissionToggle
              key={action.key}
              checked={checked}
              onChange={(val) => onChange(action.key, val)}
              label={action.label}
              description={action.description}
              disabled={disabled}
              icon={action.icon}
            />
          );
        })}
      </div>
    </div>
  );
}
