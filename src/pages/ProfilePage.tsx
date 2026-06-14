import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { db, auth } from '../firebase/config';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { 
  reauthenticateWithCredential, 
  EmailAuthProvider, 
  updatePassword 
} from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Mail, 
  Phone, 
  Shield, 
  CheckCircle2, 
  XCircle, 
  Send, 
  Lock, 
  Edit3, 
  Save, 
  X, 
  Loader2, 
  AlertCircle,
  KeyRound,
  Palette,
  Sparkles
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function ProfilePage() {
  const { user, profile } = useAuth();
  const { theme, setTheme, isApplying: themeApplying } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit profile state
  const [editFormData, setEditFormData] = useState({
    name: profile?.name || '',
    phone: profile?.phone || '',
    telegramChatId: profile?.telegramChatId || ''
  });

  // Password change state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Sync edit form when profile changes (unless currently editing)
  React.useEffect(() => {
    if (profile && !isEditing) {
      setEditFormData({
        name: profile.name,
        phone: profile.phone || '',
        telegramChatId: profile.telegramChatId || ''
      });
    }
  }, [profile, isEditing]);

  const roleTranslations: Record<string, string> = {
    'admin': 'مدير النظام الشامل',
    'company_manager': 'مدير الشركة',
    'assistant_manager': 'مساعد مدير الشركة',
    'sales_employee': 'موظف مبيعات',
    'law_firm_manager': 'مدير مكتب المحاماة',
    'law_firm_assistant': 'محامي مساعد خارجي',
    'law_manager': 'مدير المكتب القانوني',
    'law_assistant': 'مساعد قانوني',
    'company_assistant': 'مساعد الشركة',
    'employee': 'موظف عادي'
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        name: editFormData.name,
        phone: editFormData.phone,
        telegramChatId: editFormData.telegramChatId,
        updatedAt: serverTimestamp()
      });
      setSuccess('تم تحديث بياناتك الشخصية بنجاح');
      setIsEditing(false);
    } catch (err: any) {
      console.error(err);
      setError('فشل تحديث البيانات. يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.email) return;
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('كلمة المرور الجديدة غير متطابقة مع تأكيدها');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const credential = EmailAuthProvider.credential(user.email, passwordData.currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, passwordData.newPassword);
      
      setSuccess('تم تحديث كلمة المرور بنجاح');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/wrong-password') {
        setError('كلمة المرور الحالية غير صحيحة');
      } else if (err.code === 'auth/weak-password') {
        setError('كلمة المرور الجديدة ضعيفة جداً');
      } else {
        setError('حدث خطأ أثناء تحديث كلمة المرور. يرجى إعادة تسجيل الدخول والمحاولة.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!profile) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      <p className="text-slate-500 font-medium font-sans">جاري تحميل بيانات الملف الشخصي...</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6" dir="rtl">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">ملفي الشخصي</h1>
          <p className="text-slate-500 text-sm mt-1">عرض وإدارة بيانات حسابك الشخصي</p>
        </div>
        <div className="flex gap-3">
          {success && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-green-50 text-green-700 px-4 py-2 rounded-xl text-xs font-bold border border-green-100 flex items-center gap-2"
            >
              <CheckCircle2 size={16} />
              {success}
            </motion.div>
          )}
          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-red-50 text-red-700 px-4 py-2 rounded-xl text-xs font-bold border border-red-100 flex items-center gap-2"
            >
              <AlertCircle size={16} />
              {error}
            </motion.div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <div className={cn(
            theme === 'glass' ? "glass-card rounded-[2.5rem] p-8 text-center" : "bg-white border border-slate-200 rounded-[2.5rem] p-8 text-center shadow-sm"
          )}>
            <div className="relative inline-block mb-6">
              <div className="w-24 h-24 bg-indigo-50 border-4 border-white shadow-xl shadow-indigo-100 rounded-[2rem] flex items-center justify-center overflow-hidden">
                <User size={40} className="text-indigo-600" />
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white rounded-xl shadow-lg border border-slate-100 flex items-center justify-center">
                <Shield size={16} className="text-indigo-600" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-1">{profile.name}</h2>
            <p className="text-sm font-bold text-indigo-600 mb-4">{roleTranslations[profile.role] || profile.role}</p>
            
            <div className="flex items-center justify-center gap-2 mb-6">
              {profile.isActive ? (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-full text-[10px] font-black uppercase">
                  <CheckCircle2 size={12} />
                  نشط
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-400 rounded-full text-[10px] font-black uppercase">
                  <XCircle size={12} />
                  معطل
                </span>
              )}
            </div>

            <div className="pt-6 border-t border-slate-50 space-y-4">
              <div className="flex items-center gap-3 text-slate-500 hover:text-indigo-600 transition-colors">
                <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center">
                  <Mail size={16} />
                </div>
                <span className="text-xs font-medium break-all">{profile.email}</span>
              </div>
              {profile.phone && (
                <div className="flex items-center gap-3 text-slate-500">
                  <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center">
                    <Phone size={16} />
                  </div>
                  <span className="text-xs font-medium">{profile.phone}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Areas */}
        <div className="lg:col-span-2 space-y-8">
          {/* Detailed Info Card */}
          <div className={cn(
            theme === 'glass' ? "glass-card rounded-[2.5rem] overflow-hidden" : "bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden"
          )}>
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-xl shadow-sm">
                  <User size={20} className="text-slate-400" />
                </div>
                <h3 className="font-bold text-slate-900">البيانات الأساسية</h3>
              </div>
              {!isEditing && (
                <button 
                  onClick={() => {
                    setEditFormData({
                      name: profile.name,
                      phone: profile.phone || '',
                      telegramChatId: profile.telegramChatId || ''
                    });
                    setIsEditing(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-indigo-600 font-bold text-xs hover:bg-indigo-50 rounded-xl transition-all"
                >
                  <Edit3 size={16} />
                  تعديل البيانات
                </button>
              )}
            </div>

            <div className="p-8">
              {isEditing ? (
                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mr-1">الاسم الكامل</label>
                      <input 
                        required
                        type="text"
                        value={editFormData.name}
                        onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mr-1">رقم الهاتف</label>
                      <input 
                        type="tel"
                        value={editFormData.phone}
                        onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700"
                        dir="ltr"
                        placeholder="05xxxxxxxx"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mr-1 flex items-center gap-2">
                       معرف تيليجرام
                      <span className="text-[10px] font-normal lowercase text-slate-400">Telegram Chat ID</span>
                    </label>
                    <div className="relative">
                      <Send className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input 
                        type="text"
                        value={editFormData.telegramChatId}
                        onChange={(e) => setEditFormData({...editFormData, telegramChatId: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl pr-5 pl-12 py-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700"
                        placeholder="مثال: 123456789"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button 
                      type="submit"
                      disabled={loading}
                      className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save size={18} />}
                      حفظ التغييرات
                    </button>
                    <button 
                      type="button"
                      onClick={() => setIsEditing(false)}
                      disabled={loading}
                      className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                    >
                      <X size={18} />
                      إلغاء
                    </button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">الاسم بالكامل</label>
                    <div className="text-lg font-bold text-slate-900">{profile.name}</div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">البريد الإلكتروني</label>
                    <div className="text-lg font-bold text-slate-900 font-sans">{profile.email}</div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">رقم الجوال</label>
                    <div className="text-lg font-bold text-slate-900 font-mono tracking-tighter" dir="ltr">{profile.phone || '—'}</div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">معرف تيليجرام</label>
                    <div className="flex items-center gap-2">
                      <Send size={14} className="text-indigo-400" />
                      <div className="text-lg font-bold text-slate-900 font-mono">{profile.telegramChatId || 'غير مربوط'}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Theme Settings Card */}
          <div className={cn(
            theme === 'glass' ? "glass-card rounded-[2.5rem] overflow-hidden" : "bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden"
          )}>
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/30">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-xl shadow-sm">
                  <Palette size={20} className="text-indigo-600" />
                </div>
                <h3 className="font-bold text-slate-900">إعدادات مظهر الواجهة والنظام</h3>
              </div>
            </div>

            <div className="p-8">
              <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                خصّص بيئة عملك باختيار السمة المفضلة لديك. يتم حفظ التغييرات على حسابك تلقائيًا لملاءمة إبحارك ومظهر نوافذك.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Classic Theme Button */}
                <button
                  type="button"
                  onClick={() => setTheme('classic')}
                  disabled={themeApplying}
                  className={cn(
                    "relative flex flex-col items-start p-6 rounded-[2rem] border-2 text-right transition-all group cursor-pointer w-full",
                    theme === 'classic'
                      ? "border-indigo-600 bg-indigo-50/30"
                      : "border-slate-100 bg-slate-50/50 hover:border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center justify-between w-full mb-3">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">المظهر الافتراضي</span>
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                      theme === 'classic' ? "border-indigo-600 bg-indigo-600" : "border-slate-300"
                    )}>
                      {theme === 'classic' && <span className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-900 mb-2">ثيم كلاسيكي وقور (Classic)</h4>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    نسق رسمي وعملي يعتمد على مظهر مألوف ومستقر وخلفية بيضاء صقيلة للعمل الكلاسيكي المركز.
                  </p>
                </button>

                {/* Glass Theme Button */}
                <button
                  type="button"
                  onClick={() => setTheme('glass')}
                  disabled={themeApplying}
                  className={cn(
                    "relative flex flex-col items-start p-6 rounded-[2rem] border-2 text-right transition-all group cursor-pointer w-full",
                    theme === 'glass'
                      ? "border-indigo-600 bg-indigo-50/30"
                      : "border-slate-100 bg-slate-50/50 hover:border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center justify-between w-full mb-3">
                    <span className="text-xs font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1">
                      <Sparkles size={12} className="text-indigo-500 fill-indigo-100" />
                      موصى به
                    </span>
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                      theme === 'glass' ? "border-indigo-600 bg-indigo-600" : "border-slate-300"
                    )}>
                      {theme === 'glass' && <span className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </div>
                  <h4 className="text-sm font-extrabold text-indigo-700 mb-2">ثيم متدرج زجاجي (Glass Gradient)</h4>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    تأثير زجاجي شفاف وخفيف وخلفيات مائية متموجة تساند أرقى ملمح تصميمي فسيح وعصري.
                  </p>
                </button>
              </div>

              {themeApplying && (
                <div className="mt-4 flex items-center gap-2 justify-center text-xs font-bold text-indigo-600 animate-pulse">
                  <Loader2 size={14} className="animate-spin" />
                  جاري حفظ تفضيل مظهرك المختار بأمان...
                </div>
              )}
            </div>
          </div>

          {/* Change Password Card */}
          <div className={cn(
            theme === 'glass' ? "glass-card rounded-[2.5rem] overflow-hidden" : "bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden"
          )}>
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/30">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-xl shadow-sm">
                  <Lock size={20} className="text-slate-400" />
                </div>
                <h3 className="font-bold text-slate-900">الأمان وتغيير كلمة المرور</h3>
              </div>
            </div>

            <div className="p-8">
              <form onSubmit={handleChangePassword} className="space-y-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mr-1">كلمة المرور الحالية</label>
                  <div className="relative">
                    <KeyRound className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none" />
                    <input 
                      required
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl pr-14 pl-5 py-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700 tracking-widest"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mr-1">كلمة المرور الجديدة</label>
                    <input 
                      required
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700 tracking-widest"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mr-1">تأكيد كلمة المرور الجديدة</label>
                    <input 
                      required
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700 tracking-widest"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full md:w-auto px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl flex items-center justify-center gap-3"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock size={18} />}
                    تحديث كلمة المرور الآمنة
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
