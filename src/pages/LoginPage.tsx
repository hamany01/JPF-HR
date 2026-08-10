import React, { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase/config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { LogIn, Mail, Lock, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import JpfLogo from '../components/Layout/JpfLogo';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (error: any) {
      console.error('Login failed:', error);
      let message = 'بيانات الدخول غير صحيحة';
      if (error.code === 'auth/user-not-found') message = 'المستخدم غير موجود';
      if (error.code === 'auth/wrong-password') message = 'كلمة المرور غير صحيحة';
      if (error.code === 'auth/invalid-email') message = 'البريد الإلكتروني غير صالح';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await sendPasswordResetEmail(auth, resetEmail, {
        url: window.location.origin + '/login',
      });
      setSuccessMessage('✅ تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني بنجاح');
      setResetEmail('');
    } catch (error: any) {
      console.error('Reset failed:', error);
      let message = 'حدث خطأ أثناء إرسال البريد';
      if (error.code === 'auth/user-not-found') message = 'البريد الإلكتروني غير مسجل';
      if (error.code === 'auth/invalid-email') message = 'البريد الإلكتروني غير صالح';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // SECURITY FIX: Email domain whitelist — only authorized domains can self-register.
      // Add your company domains below, or set VITE_ALLOWED_EMAIL_DOMAINS env var (comma-separated).
      const allowedDomains = (import.meta.env.VITE_ALLOWED_EMAIL_DOMAINS || '')
        .split(',')
        .map((d: string) => d.trim().toLowerCase())
        .filter(Boolean);

      if (allowedDomains.length > 0) {
        const emailDomain = (user.email || '').split('@')[1]?.toLowerCase() || '';
        if (!allowedDomains.includes(emailDomain)) {
          // Sign out the unauthorized user immediately
          await auth.signOut();
          setError(`غير مصرح: النطاق "${emailDomain}" غير مسموح به. تواصل مع مدير النظام.`);
          return;
        }
      }

      // التأكد من تسجيل المستخدم بقاعدة البيانات Firestore
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        // SECURITY FIX: New Google users get 'employee' role and must be activated by admin.
        // They cannot self-assign admin or privileged roles.
        await setDoc(userRef, {
          name: user.displayName || 'Unnamed User',
          email: user.email,
          phone: '',
          role: 'employee',
          isActive: false, // SECURITY FIX: New users are inactive until an admin activates them
          telegramChatId: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setError('تم إنشاء حسابك بنجاح. يرجى التواصل مع مدير النظام لتفعيل حسابك.');
        await auth.signOut();
        return;
      }

      // Check if user account is active
      const existingData = userDoc.data();
      if (existingData.isActive === false) {
        await auth.signOut();
        setError('حسابك غير مفعّل. يرجى التواصل مع مدير النظام لتفعيل حسابك.');
        return;
      }

      navigate('/');
    } catch (error: any) {
      console.error('Login failed:', error);
      setError('فشل تسجيل الدخول عبر Google');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans relative overflow-hidden" dir="rtl">
      
      {/* خلفية جمالية متموجة للعمق البصري */}
      <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-indigo-100/40 via-purple-100/10 to-transparent pointer-events-none -none"></div>
      <div className="absolute bottom-0 right-10 w-80 h-80 bg-blue-100/20 rounded-full filter blur-3xl pointer-events-none -none"></div>
      <div className="absolute top-1/4 left-10 w-96 h-96 bg-purple-100/20 rounded-full filter blur-3xl pointer-events-none -none"></div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md p-8 sm:p-10 bg-white shadow-[0_32px_64px_-15px_rgba(15,23,42,0.08)] rounded-[2rem] border border-slate-100/80 relative z-10"
      >
        {/* قسم الهوية التجارية والشعار */}
        <div className="flex flex-col items-center mb-10 text-center">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="mb-6"
          >
            <JpfLogo className="h-20 max-h-20 object-contain mx-auto" />
          </motion.div>
          
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">نظام الشؤون القانونية</h1>
          <p className="text-slate-500 mt-2 font-bold text-sm">شركة مصنع جدة للدهانات و المعاجيين</p>
        </div>

        {/* عرض رسائل الخطأ الحركية */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3 text-rose-600 text-xs sm:text-sm font-bold"
          >
            <AlertCircle size={18} className="text-rose-500 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        {/* عرض رسائل النجاح للمستخدم */}
        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3 text-emerald-600 text-xs sm:text-sm font-bold"
          >
            <AlertCircle size={18} className="text-emerald-500 shrink-0" />
            <span>{successMessage}</span>
          </motion.div>
        )}

        {!showForgotPassword ? (
          <>
            <form onSubmit={handleEmailLogin} className="space-y-4 mb-6">
              
              {/* حقل البريد الإلكتروني مع أيقونة مساعدة */}
              <div className="space-y-1">
                <div className="relative">
                  <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input 
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="البريد الإلكتروني المهني"
                    className="w-full bg-slate-50 border border-slate-200/60 rounded-xl pr-12 pl-4 py-3.5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-400 text-sm"
                  />
                </div>
              </div>

              {/* حقل كلمة المرور الآمنة */}
              <div className="space-y-1">
                <div className="relative">
                  <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input 
                    required
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="كلمة المرور"
                    className="w-full bg-slate-50 border border-slate-200/60 rounded-xl pr-12 pl-4 py-3.5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-400 text-sm"
                  />
                </div>
              </div>

              {/* رابط استرجاع الحساب */}
              <div className="flex justify-end">
                <button 
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(true);
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  هل نسيت كلمة المرور؟
                </button>
              </div>

              {/* زر إرسال تسجيل الدخول */}
              <button
                disabled={loading}
                type="submit"
                className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50 cursor-pointer text-sm"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                <span>تسجيل الدخول الآمن</span>
              </button>
            </form>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
              <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest bg-white px-4 text-slate-300">أو الإدارة السريعة</div>
            </div>

            {/* الدخول المريح بجوجل */}
            <button
              onClick={handleGoogleLogin}
              type="button"
              className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white border-2 border-slate-100 hover:border-indigo-100 hover:bg-slate-50 rounded-xl transition-all text-slate-700 font-bold shadow-sm active:scale-[0.98] cursor-pointer text-sm"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
              <span>المتابعة بـ Google</span>
            </button>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="text-center space-y-2">
              <h2 className="text-lg font-bold text-slate-900">استرداد الحساب المهني</h2>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                أدخل عنوان بريدك وسوف نرسل لك رابطاً مشفراً لتعيين كلمة مرور جديدة على الفور
              </p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="relative">
                <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input 
                  required
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="عنوان البريد الإلكتروني"
                  className="w-full bg-slate-50 border border-slate-200/60 rounded-xl pr-12 pl-4 py-3.5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-400 text-sm"
                />
              </div>

              <div className="flex flex-col gap-3">
                <button
                  disabled={loading}
                  type="submit"
                  className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50 cursor-pointer text-sm"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
                  <span>إرسال رابط استرداد الأمن</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className="w-full py-3.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all text-xs sm:text-sm cursor-pointer"
                >
                  العودة لتسجيل الدخول الفوري
                </button>
              </div>
            </form>
          </motion.div>
        )}

        <div className="mt-8 flex flex-col items-center gap-4">
          <div className="h-[2px] w-8 bg-slate-100"></div>
          <div className="text-[10px] uppercase tracking-[0.2em] font-extrabold text-indigo-400">
            أمان وموثوقية عالية
          </div>
        </div>
      </motion.div>
      
      <p className="mt-8 text-slate-400 text-xs font-bold text-center select-none">
        &copy; 2026 جميع الحقوق محفوظة - نظام الشؤون القانونية | الإصدار 1.0
      </p>
    </div>
  );
}
