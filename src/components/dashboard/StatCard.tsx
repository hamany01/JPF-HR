import React from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'indigo' | 'emerald' | 'rose' | 'amber' | 'blue' | 'slate';
  trend?: {
    value: number;
    type: 'increase' | 'decrease';
    label?: string;
  };
}

export default function StatCard({ title, value, icon, color, trend }: StatCardProps) {
  const bgAndTextColors = {
    indigo: {
      bg: 'bg-indigo-50 dark:bg-indigo-950/20',
      iconBg: 'bg-indigo-600 text-white',
      border: 'border-indigo-100 dark:border-indigo-900/40',
    },
    emerald: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/20',
      iconBg: 'bg-emerald-600 text-white',
      border: 'border-emerald-100 dark:border-emerald-900/40',
    },
    rose: {
      bg: 'bg-rose-50 dark:bg-rose-950/20',
      iconBg: 'bg-rose-600 text-white',
      border: 'border-rose-100 dark:border-rose-900/40',
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-950/20',
      iconBg: 'bg-amber-600 text-white',
      border: 'border-amber-100 dark:border-amber-900/40',
    },
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-950/20',
      iconBg: 'bg-blue-600 text-white',
      border: 'border-blue-100 dark:border-blue-900/40',
    },
    slate: {
      bg: 'bg-slate-50 dark:bg-slate-800/20',
      iconBg: 'bg-slate-600 text-white',
      border: 'border-slate-200 dark:border-slate-800',
    },
  }[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 15 }}
      transition={{ duration: 0.3 }}
      className={`p-6 rounded-3xl border bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${bgAndTextColors.border}`}
      dir="rtl"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1.5 text-right">
          <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
            {title}
          </span>
          <span className="text-2xl font-black text-slate-800 dark:text-white block tracking-tight">
            {value}
          </span>
        </div>
        <div className={`p-3 rounded-2xl ${bgAndTextColors.iconBg} shadow-lg shrink-0`}>
          {icon}
        </div>
      </div>

      {trend && (
        <div className="mt-4 flex items-center gap-1.5 self-start">
          <div className={`flex items-center gap-0.5 text-xs font-black px-2 py-1 rounded-lg ${
            trend.type === 'increase'
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400'
          }`}>
            {trend.type === 'increase' ? (
              <ArrowUpRight className="w-3.5 h-3.5" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5" />
            )}
            <span>%{Math.abs(trend.value)}</span>
          </div>
          {trend.label && (
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
              {trend.label}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}
