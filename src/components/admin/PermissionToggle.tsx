import React from 'react';

interface PermissionToggleProps {
  key?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export default function PermissionToggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  icon,
}: PermissionToggleProps) {
  return (
    <div className={`flex items-start justify-between p-4 rounded-xl border transition-all duration-300 ${
      checked 
        ? 'bg-indigo-50/40 border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/30' 
        : 'bg-white border-slate-100 dark:bg-slate-900 dark:border-slate-800'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-indigo-200 dark:hover:border-indigo-900'}`} dir="rtl">
      <div className="flex gap-3">
        {icon && (
          <div className={`p-2 rounded-lg h-fit ${
            checked 
              ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400' 
              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
          }`}>
            {icon}
          </div>
        )}
        <div className="space-y-0.5 text-right">
          <label className="text-sm font-bold text-slate-800 dark:text-slate-200 block">
            {label}
          </label>
          {description && (
            <span className="text-xs text-slate-400 dark:text-slate-500 block">
              {description}
            </span>
          )}
        </div>
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
          checked ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
        } ${disabled ? 'cursor-not-allowed' : ''}`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? '-translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
