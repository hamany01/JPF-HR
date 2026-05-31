import React from 'react';
import { Mail, Phone, ExternalLink } from 'lucide-react';
import { APP_VERSION } from '../../config/version';

export default function Footer() {
  const currentYear = 2026;

  return (
    <footer className="mt-auto bg-white border-t border-slate-200/60 py-8 px-8" id="system-footer">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        
        {/* معلومات التطوير الإبداعي */}
        <div className="flex flex-col items-center md:items-start gap-1">
          <p className="text-sm font-bold text-slate-700">
            من تصميم وتطوير :{' '}
            <span className="text-indigo-600 hover:text-indigo-700 font-extrabold transition-colors">
              عبدالرحمن سالم باشنيني
            </span>
          </p>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 text-xs text-slate-400 font-medium select-none">
            <span>© {currentYear} جميع الحقوق محفوظة - نظام الشؤون القانونية</span>
            <span className="text-slate-300">|</span>
            <span className="text-[10px] bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded-md font-mono" title={APP_VERSION.name}>
              v{APP_VERSION.full}
            </span>
            <span className="text-[10px] text-slate-400">
              آخر تحديث: {new Date(APP_VERSION.lastUpdated).toLocaleDateString('ar-SA')}
            </span>
          </div>
        </div>

        {/* معلومات الاتصال المباشر */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          {/* رابط البريد الإلكتروني المباشر */}
          <a
            href="mailto:abdulrhman.bashniny@gmail.com"
            className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-indigo-50/50 border border-slate-100 hover:border-indigo-100 rounded-xl text-xs sm:text-sm text-slate-600 hover:text-indigo-600 font-bold transition-all duration-300 shadow-sm active:scale-95 group"
            title="أرسل بريداً إلكترونياً"
          >
            <Mail size={16} className="text-slate-400 group-hover:text-indigo-500 transition-colors shrink-0" />
            <span className="font-mono">abdulrhman.bashniny@gmail.com</span>
          </a>

          {/* رابط رقم الهاتف المباشر */}
          <a
            href="tel:0537375580"
            className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-emerald-50/50 border border-slate-100 hover:border-emerald-100 rounded-xl text-xs sm:text-sm text-slate-600 hover:text-emerald-600 font-bold transition-all duration-300 shadow-sm active:scale-95 group"
            title="اتصل بنا الآن"
          >
            <Phone size={16} className="text-slate-400 group-hover:text-emerald-500 transition-colors shrink-0" />
            <span className="font-mono" dir="ltr">0537375580</span>
          </a>
        </div>

      </div>
    </footer>
  );
}
