import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check, Copy, CheckCircle, KeyRound, ShieldAlert, Send, ArrowRight } from 'lucide-react';

interface PasswordResetModalProps {
  user: {
    name: string;
    email: string;
    telegramChatId?: string;
  };
  newPassword: string;
  telegramStatus: {
    attempted: boolean;
    success: boolean;
    errorMsg?: string;
  };
  onSendTelegramRetry?: () => Promise<void>;
  onClose: () => void;
}

export default function PasswordResetModal({
  user,
  newPassword,
  telegramStatus,
  onSendTelegramRetry,
  onClose,
}: PasswordResetModalProps) {
  const [copied, setCopied] = useState(false);
  const [retryingTelegram, setRetryingTelegram] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(newPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleRetryTelegram = async () => {
    if (!onSendTelegramRetry) return;
    setRetryingTelegram(true);
    await onSendTelegramRetry();
    setRetryingTelegram(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" dir="rtl" id="password-reset-modal">
      {/* Background Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      />

      {/* Modal Content */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto border border-slate-100"
      >
        {/* Header Icon */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-100 shadow-sm animate-bounce">
            <CheckCircle size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-1.5 font-sans">
            تمت إعادة توليد كلمة المرور بنجاح
          </h3>
          <p className="text-slate-500 text-xs font-bold font-sans">
            حساب الموظف: <span className="text-slate-800 font-black">{user.name}</span>
          </p>
          <span className="text-[10px] text-slate-400 font-mono block mt-1">{user.email}</span>
        </div>

        {/* Password Display Box */}
        <div className="bg-slate-50 dark:bg-slate-950/20 rounded-2xl p-5 border border-slate-100 mb-6 space-y-3">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">كلمة المرور الجديدة والآمنة</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white border border-slate-150 px-4 py-3 rounded-xl font-mono text-lg text-indigo-700 tracking-wider text-center font-bold font-sans select-all select-text break-all">
              {newPassword}
            </code>
            <button
              onClick={handleCopy}
              className={`p-3.5 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
                copied 
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100'
              }`}
              title="نسخ إلى الحافظة"
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
            </button>
          </div>
          <p className="text-[10px] text-slate-400 leading-normal">
            * كلمة المرور تم توليدها بالنمط الآمن المطور وتحتوي على رموز وحروف خاصة للمزيد من حماية الحساب.
          </p>
        </div>

        {/* Telegram Transmission Status */}
        {user.telegramChatId ? (
          <div className={`p-4 rounded-2xl border mb-6 flex flex-col gap-2 transition-colors ${
            telegramStatus.success 
              ? 'bg-sky-50/50 border-sky-100 text-sky-800' 
              : 'bg-amber-50/70 border-amber-100 text-amber-800'
          }`}>
            <div className="flex items-center gap-2.5">
              <div className={`p-1.5 rounded-lg ${telegramStatus.success ? 'bg-sky-100 text-sky-600' : 'bg-amber-100 text-amber-600'}`}>
                <Send size={15} />
              </div>
              <div className="flex-1">
                <span className="text-xs font-black block">إشعار تيليجرام التلقائي</span>
                <span className="text-[10px] opacity-80 block font-bold leading-tight">
                  {telegramStatus.success 
                    ? 'تم إرسال كلمة المرور الجديدة تلقائياً إلى معرّف تيليجرام الخاص بالموظف.' 
                    : 'فشل إرسال الإشعار لـ تيليجرام تلقائياً (تأكد من إعدادات البوت والاتصال).'
                  }
                </span>
              </div>
            </div>

            {/* Error Message & Retry Button */}
            {!telegramStatus.success && (
              <div className="mt-2 pt-2 border-t border-amber-100/50 flex align-middle justify-between items-center gap-2">
                <span className="text-[9px] text-amber-600 font-mono truncate max-w-[200px]" title={telegramStatus.errorMsg}>
                  {telegramStatus.errorMsg || 'خطأ غير معروف'}
                </span>
                {onSendTelegramRetry && (
                  <button
                    onClick={handleRetryTelegram}
                    disabled={retryingTelegram}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-[9px] font-black rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {retryingTelegram ? 'جاري إعادة الإرسال...' : 'إعادة إرسال'}
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl mb-6 flex items-center gap-2.5">
            <span className="text-[10px] text-slate-450 font-bold block leading-relaxed">
              💡 الحساب ليس لديه معرّف تيليجرام مسجل. يرجى تزويد الموظف يدوياً بكلمة المرور الجديدة.
            </span>
          </div>
        )}

        {/* Security Warning Accordion */}
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-6 flex gap-3">
          <div className="text-amber-600">
            <ShieldAlert size={20} />
          </div>
          <div className="space-y-1">
            <span className="text-xs font-black text-amber-900 block">تعليمات الحماية والأمان</span>
            <span className="text-[10px] text-amber-800 leading-relaxed block">
              تأكد من مشاركة كلمة المرور مع الموظف عبر قنوات آمنة وموثقة. يُنصح بتوجيه الموظف لتغيير كلمة المرور فور تسجيل الدخول من خلال صفحة "الحساب الشخصي".
            </span>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onClose}
          className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold font-sans transition-all shadow-xl shadow-slate-100 cursor-pointer flex items-center justify-center gap-2"
        >
          <span>تم الحفظ والإغلاق</span>
          <ArrowRight size={16} className="rotate-180" />
        </button>
      </motion.div>
    </div>
  );
}
