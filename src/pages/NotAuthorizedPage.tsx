import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

export default function NotAuthorizedPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-right font-sans" dir="rtl">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-6">
          <ShieldAlert className="w-10 h-10" />
        </div>
        
        <h1 className="text-2xl font-bold font-sans text-slate-950 mb-3 tracking-tight">
          غير مصرح بالدخول
        </h1>
        
        <p className="text-slate-500 font-sans leading-relaxed mb-8">
          عذراً، لا تمتلك الصلاحيات الكافية للوصول إلى هذه الصفحة أو الميزة. يرجى مراجعة مسؤول النظام إذا كان هذا خطأً.
        </p>
        
        <button
          onClick={() => navigate('/')}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 px-6 rounded-2xl transition-all duration-200"
        >
          العودة لوحة التحكم الرئيسة
        </button>
      </div>
    </div>
  );
}
