import React from 'react';
import { APP_VERSION } from '../config/version';
import { Info, Calendar, Code, Shield, Building, Sparkles } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6" dir="rtl" id="about-page-container">
      <div className="bg-white rounded-3xl shadow-xl shadow-slate-100/80 border border-slate-100 p-8 md:p-10 relative overflow-hidden">
        {/* خلفية زخرفية مميزة */}
        <div className="absolute top-0 right-0 w-44 h-44 bg-indigo-50/40 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-emerald-50/30 rounded-full blur-2xl -z-10" />

        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-5 border border-indigo-100 shadow-sm shadow-indigo-100/50">
            <Info className="w-10 h-10 animate-pulse" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-2 font-sans tracking-tight">
            نظام JPF-HR المطور
          </h1>
          <p className="text-slate-500 font-bold text-sm tracking-wide">
            البوابة الذكية لإدارة الموارد البشرية والشؤون القانونية
          </p>
          <div className="flex items-center justify-center gap-1.5 mt-3 text-slate-400">
            <Building size={14} />
            <span className="text-xs font-bold font-sans">شركة مصنع جدة للدهانات والمعاجين</span>
          </div>
        </div>
        
        {/* معلومات الإصدار */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          <div className="bg-slate-50/80 border border-slate-100 rounded-2xl p-5 hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Code className="w-5 h-5" />
              </div>
              <span className="text-xs font-extrabold text-slate-500">رقم الإصدار الحالي</span>
            </div>
            <p className="text-3xl font-black text-indigo-600 font-mono tracking-wider">
              v{APP_VERSION.full}
            </p>
          </div>
          
          <div className="bg-slate-50/80 border border-slate-100 rounded-2xl p-5 hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <Calendar className="w-5 h-5" />
              </div>
              <span className="text-xs font-extrabold text-slate-500">تاريخ آخر تحديث</span>
            </div>
            <p className="text-lg font-black text-slate-800 font-sans">
              {new Date(APP_VERSION.lastUpdated).toLocaleDateString('ar-SA', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
        </div>
        
        {/* اسم الإصدار وملاحظات التشغيل */}
        <div className="bg-indigo-600 text-white rounded-3xl p-6 md:p-8 mb-8 shadow-xl shadow-indigo-600/10 relative overflow-hidden group">
          <div className="absolute top-1/2 left-4 -translate-y-1/2 text-white/5 pointer-events-none transition-transform group-hover:scale-110">
            <Sparkles size={120} />
          </div>
          <div className="relative z-10 space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-indigo-500/60 text-indigo-50 text-[10px] font-black px-2.5 py-1 rounded-full border border-indigo-400/30">الإصدار الخاص</span>
              <h3 className="font-extrabold text-lg text-white font-sans">{APP_VERSION.name}</h3>
            </div>
            <p className="text-xs text-indigo-100/90 leading-relaxed font-bold font-sans">
              {APP_VERSION.notes}
            </p>
          </div>
        </div>
        
        {/* الميزات */}
        <div className="border-t border-slate-100 pt-8">
          <h3 className="font-black text-slate-800 text-base mb-5 flex items-center gap-3">
            <Shield className="w-5 h-5 text-indigo-600" />
            <span>الميزات والخصائص الهيكلية للنظام</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-bold text-slate-600">
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-all border border-slate-50">
              <span className="text-indigo-600 shrink-0 font-black text-sm">✓</span>
              <span>نظام صلاحيات ديناميكي متقدم ومتعدد المستويات والأدوار</span>
            </div>
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-all border border-slate-50">
              <span className="text-indigo-600 shrink-0 font-black text-sm">✓</span>
              <span>لوحات تحكم ذكية وإحصائيات تفصيلية مخصصة لكل دور وظيفي</span>
            </div>
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-all border border-slate-50">
              <span className="text-indigo-600 shrink-0 font-black text-sm">✓</span>
              <span>نظام تدوين الملاحظات المتطور مع عزل تام وتصنيف الصلاحيات</span>
            </div>
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-all border border-slate-50">
              <span className="text-indigo-600 shrink-0 font-black text-sm">✓</span>
              <span>ربط مباشر وتنبيهات تفاعلية عبر قنوات Telegram و Mail</span>
            </div>
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-all border border-slate-50">
              <span className="text-indigo-600 shrink-0 font-black text-sm">✓</span>
              <span>توليد آمن وتوطين لكلمات مرور عشوائية مع خيارات تيليجرام التلقائية</span>
            </div>
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-all border border-slate-50">
              <span className="text-indigo-600 shrink-0 font-black text-sm">✓</span>
              <span>تصميم واجهات احترافي بالكامل متجاوب مع الهواتف الذكية</span>
            </div>
          </div>
        </div>
        
        {/* معلومات الشركة */}
        <div className="border-t border-slate-100 pt-8 mt-8 text-center space-y-1">
          <p className="text-xs text-slate-500 font-extrabold select-none">© {new Date().getFullYear()} مصنع جدة للدهانات والمعاجين </p>
          <p className="text-[10px] text-slate-400 font-bold select-none">الشؤون القانونية والموارد البشرية - جميع الحقوق محفوظة</p>
        </div>
      </div>
    </div>
  );
}
