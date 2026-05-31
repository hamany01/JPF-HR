import React, { useState, useEffect } from 'react';
import { doc, setDoc, deleteDoc, serverTimestamp, collection, getDocs, updateDoc, getDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { toast } from 'react-hot-toast';
import { db } from '../firebase/config';
import firebaseConfig from '../../firebase-applet-config.json';
import { motion, AnimatePresence } from 'motion/react';
import { UserCheck, UserX, X, Loader2, Edit, Trash2, AlertTriangle, KeyRound } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import PasswordResetModal from '../components/admin/PasswordResetModal';
import { generateSecurePassword } from '../utils/passwordGenerator';

export default function UserManagementPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdUser, setCreatedUser] = useState<{email: string, password: string} | null>(null);
  const { isAdmin } = useAuth();

  // Password Reset State
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetUser, setResetUser] = useState<any | null>(null);
  const [newGeneratedPassword, setNewGeneratedPassword] = useState('');
  const [telegramStatus, setTelegramStatus] = useState<{ attempted: boolean; success: boolean; errorMsg?: string }>({
    attempted: false,
    success: false,
  });

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'law_assistant',
    isActive: true
  });

  const generatePassword = () => {
    const pass = `Temp@${Math.floor(1000 + Math.random() * 9000)}`;
    setFormData(prev => ({ ...prev, password: pass }));
  };

  const openAddModal = () => {
    setModalMode('add');
    setSelectedUserId(null);
    setCreatedUser(null);
    setErrorMsg(null);
    setFormData({ name: '', email: '', phone: '', password: '', role: 'law_assistant', isActive: true });
    setIsModalOpen(true);
  };

  const openEditModal = (user: any) => {
    setModalMode('edit');
    setSelectedUserId(user.id);
    setCreatedUser(null);
    setErrorMsg(null);
    setFormData({ 
      name: user.name || '', 
      email: user.email || '', 
      phone: user.phone || '', 
      telegramChatId: user.telegramChatId || '',
      password: '', 
      role: user.role || 'law_assistant', 
      isActive: user.isActive ?? true 
    });
    setIsModalOpen(true);
  };

  const confirmDelete = (user: any) => {
    setSelectedUserId(user.id);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!isAdmin || !selectedUserId) return;
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, 'users', selectedUserId));
      setIsDeleteModalOpen(false);
      toast.success('تم حذف المستخدم من قاعدة البيانات');
      fetchUsers();
    } catch (error) {
      toast.error('فشل حذف المستخدم');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const userData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(userData);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const toggleStatus = async (user: any) => {
    if (!isAdmin) {
      toast.error('عذراً، لا تملك صلاحية تعديل حالة المستخدمين');
      return;
    }
    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, {
        isActive: !user.isActive,
        updatedAt: serverTimestamp(),
      });
      toast.success(`تم ${!user.isActive ? 'تفعيل' : 'تعطيل'} المستخدم بنجاح`);
      fetchUsers();
    } catch (error) {
      toast.error('فشل تحديث الحالة');
    }
  };

  const changeRole = async (user: any, newRole: string) => {
    if (!isAdmin) {
      toast.error('عذراً، لا تملك صلاحية تعديل الأدوار');
      return;
    }
    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, {
        role: newRole,
        updatedAt: serverTimestamp(),
      });
      toast.success('تم تحديث دور المستخدم');
      fetchUsers();
    } catch (error) {
      toast.error('فشل تحديث الدور');
    }
  };

  // إرسال كلمة المرور لتيليجرام
  const sendPasswordTelegramMessage = async (targetUser: any, passwordValue: string) => {
    if (!targetUser.telegramChatId) return;
    
    try {
      const settingsSnap = await getDoc(doc(db, 'notificationSettings', 'global'));
      const settings = settingsSnap.exists() ? settingsSnap.data() : null;
      const botToken = settings?.telegram?.botToken || import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
      
      if (!botToken) {
        setTelegramStatus({
          attempted: true,
          success: false,
          errorMsg: 'بوت تيليجرام غير مهيأ في إعدادات الإشعارات',
        });
        return;
      }
      
      const message = `
🔐 <b>إعادة تعيين كلمة المرور - JPF HR</b>

مرحباً <b>${targetUser.name}</b>،

تمت إعادة تعيين كلمة المرور الخاصة بك بنجاح في نظام JPF-HR.

📧 <b>البريد الإلكتروني:</b> <code>${targetUser.email}</code>
🔑 <b>كلمة المرور الجديدة:</b> <code>${passwordValue}</code>

⚠️ يُنصح بشدة بتسجيل الدخول وتغيير كلمة المرور من لوحة التحكم في صفحة "الملف الشخصي" لحماية حسابك العريق.

• <b>تاريخ العملية:</b> ${new Date().toLocaleDateString('ar-SA')} @ ${new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
• <b>الحماية والأمان:</b> JPF-HR 🦾
      `.trim();

      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: targetUser.telegramChatId,
          text: message,
          parse_mode: 'HTML',
        }),
      });

      if (response.ok) {
        setTelegramStatus({ attempted: true, success: true });
        toast.success('تم إرسال إشعار تيليجرام للموظف بنجاح');
      } else {
        const errJson = await response.json();
        setTelegramStatus({
          attempted: true,
          success: false,
          errorMsg: errJson.description || 'فشل إرسال الرسالة إلى خادم تيليجرام',
        });
      }
    } catch (err: any) {
      console.error('Error sending Telegram:', err);
      setTelegramStatus({
        attempted: true,
        success: false,
        errorMsg: err.message || 'خطأ في الاتصال بالشبكة',
      });
    }
  };

  // دالة إعادة توليد كلمة المرور للأدمن
  const handleResetPassword = async (targetUser: any) => {
    if (!isAdmin) {
      toast.error('عذراً، صلاحية إعادة تعيين كلمة المرور مخصصة للأدمن فقط');
      return;
    }

    const confirmed = window.confirm(`هل أنت متأكد من إعادة توليد كلمة المرور للموظف: ${targetUser.name}؟`);
    if (!confirmed) return;

    const toastId = toast.loading('جاري توليد كلمة مرور جديدة...');
    try {
      const generatedPass = generateSecurePassword();
      
      // استدعاء دالة Cloud Function باستخدام SDK مع تمرير اسم الدالة
      const functionsInstance = getFunctions(getApp());
      const resetPasswordCallable = httpsCallable<{ userId: string; newPassword: string }, { success: boolean; message?: string }>(
        functionsInstance,
        'resetUserPassword'
      );
      
      await resetPasswordCallable({
        userId: targetUser.id,
        newPassword: generatedPass
      });

      // إعداد بيانات المودال والولاية
      setResetUser(targetUser);
      setNewGeneratedPassword(generatedPass);
      setResetModalOpen(true);
      
      toast.success('تم إعادة توليد كلمة المرور بنجاح وتسجيل العملية', { id: toastId });

      // إرسال عبر Telegram إذا كان مسجلاً
      if (targetUser.telegramChatId) {
        setTelegramStatus({ attempted: true, success: false, errorMsg: 'جاري الإرسال...' });
        await sendPasswordTelegramMessage(targetUser, generatedPass);
      } else {
        setTelegramStatus({ attempted: false, success: false });
      }

    } catch (error: any) {
      console.error('Password reset failed:', error);
      
      // رسالة توجيهية سهلة الفهم للعميل في حال دالة Cloud Function لم تُنشر بعد
      toast.error(`فشل إعادة التعيين: يرجى التأكد من نشر وظيفة Cloud Function أولاً. (${error.message || error.code})`, { id: toastId });
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (modalMode === 'add') {
        if (!formData.password) {
          throw new Error('يرجى إدخال أو توليد كلمة مرور مؤقتة');
        }

        // 1. إنشاء تطبيق ثانوي لإنشاء المستخدم دون تسجيل الخروج
        const secondaryApp = getApps().length > 1 
          ? getApp('SecondaryApp') 
          : initializeApp(firebaseConfig, 'SecondaryApp');
        const secondaryAuth = getAuth(secondaryApp);
        
        // 2. إنشاء المستخدم في Auth
        const userCredential = await createUserWithEmailAndPassword(
          secondaryAuth, 
          formData.email, 
          formData.password
        );
        const newUserId = userCredential.user.uid;

        // 3. إنشاء الوثيقة في Firestore
        await setDoc(doc(db, 'users', newUserId), {
          name: formData.name,
          email: formData.email,
          phone: formData.phone || "",
          role: formData.role,
          isActive: formData.isActive,
          telegramChatId: formData.telegramChatId || "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // 4. إنهاء العملية
        await secondaryAuth.signOut();
        setCreatedUser({ email: formData.email, password: formData.password });
      } else {
        // Edit Mode
        if (!selectedUserId) return;
        const userRef = doc(db, 'users', selectedUserId);
        await updateDoc(userRef, {
          name: formData.name,
          phone: formData.phone || "",
          telegramChatId: formData.telegramChatId || "",
          role: formData.role,
          isActive: formData.isActive,
          updatedAt: serverTimestamp(),
        });
        setIsModalOpen(false);
      }
      
      setFormData({ name: '', email: '', phone: '', telegramChatId: '', password: '', role: 'law_assistant', isActive: true });
      fetchUsers();
    } catch (error: any) {
      console.error("Error saving user:", error);
      let message = "حدث خطأ غير متوقع";
      if (error.code === 'auth/email-already-in-use') message = "البريد الإلكتروني مستخدم مسبقاً";
      if (error.code === 'auth/invalid-email') message = "البريد الإلكتروني غير صالح";
      if (error.code === 'auth/weak-password') message = "كلمة المرور ضعيفة جداً";
      if (error.message) message = error.message;
      setErrorMsg(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCreatedUser(null);
    setErrorMsg(null);
    setFormData({ name: '', email: '', phone: '', password: '', role: 'law_assistant', isActive: true });
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      <div className="text-slate-500 font-medium font-sans">جاري التحميل...</div>
    </div>
  );

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">إدارة المستخدمين</h1>
          <p className="text-slate-500 text-sm">إدارة مجموعة: <span className="font-mono bg-slate-100 px-1 rounded text-xs">users</span></p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 text-sm bg-white border border-slate-200 hover:bg-slate-50 rounded-lg font-medium transition-colors shadow-sm text-slate-600">تصدير CSV</button>
            <button 
              disabled={!isAdmin}
              onClick={openAddModal}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg font-medium shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:shadow-none"
            >
              + إضافة مستخدم
            </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden text-sm">
        <table className="w-full text-right border-collapse">
          <thead className="bg-slate-50/50 text-slate-500 uppercase tracking-tight text-[11px] font-bold border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 font-semibold tracking-wider text-right">الاسم</th>
              <th className="px-6 py-4 font-semibold tracking-wider text-right">الدور</th>
              <th className="px-6 py-4 font-semibold tracking-wider text-right">الحالة</th>
              <th className="px-6 py-4 font-semibold tracking-wider text-right">معرف تيليجرام</th>
              <th className="px-6 py-4 text-left font-semibold tracking-wider">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-900">{user.name}</span>
                    <span className="text-slate-500 text-xs">{user.email}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <select 
                    value={user.role} 
                    disabled={!isAdmin}
                    onChange={(e) => changeRole(user, e.target.value)}
                    className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none uppercase tracking-tight disabled:opacity-50"
                  >
                    <option value="admin">مدير النظام</option>
                    <option value="company_manager">مدير الشركة</option>
                    <option value="company_assistant">مساعد الشركة</option>
                    <option value="law_manager">مدير المكتب القانوني</option>
                    <option value="law_assistant">مساعد قانوني</option>
                    <option value="employee">موظف</option>
                  </select>
                </td>
                <td className="px-6 py-4">
                  <div className={cn(
                    "flex items-center gap-1.5 text-xs font-bold",
                    user.isActive ? "text-green-600" : "text-slate-400"
                  )}>
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      user.isActive ? "bg-green-500" : "bg-slate-300"
                    )} />
                    {user.isActive ? 'نشط' : 'غير نشط'}
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-400 font-mono text-xs">
                  {user.telegramChatId || '—'}
                </td>
                <td className="px-6 py-4 text-left">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => openEditModal(user)}
                      disabled={!isAdmin}
                      title="تعديل"
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all disabled:opacity-50"
                    >
                      <Edit size={16} />
                    </button>
                    <button 
                      onClick={() => handleResetPassword(user)}
                      disabled={!isAdmin}
                      title="إعادة توليد كلمة المرور"
                      className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all disabled:opacity-50"
                    >
                      <KeyRound size={16} />
                    </button>
                    <button 
                      onClick={() => toggleStatus(user)}
                      disabled={!isAdmin}
                      title={user.isActive ? 'تعطيل' : 'تفعيل'}
                      className={cn(
                        "p-1.5 rounded-lg transition-all disabled:opacity-50",
                        user.isActive 
                          ? "text-slate-400 hover:text-orange-600 hover:bg-orange-50" 
                          : "text-slate-400 hover:text-green-600 hover:bg-green-50"
                      )}
                    >
                      {user.isActive ? <UserX size={16} /> : <UserCheck size={16} />}
                    </button>
                    <button 
                      onClick={() => confirmDelete(user)}
                      disabled={!isAdmin}
                      title="حذف"
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
           <span>عرض {users.length} مستخدمين</span>
           <div className="flex gap-1" dir="ltr">
             <button className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 bg-white text-slate-400 disabled:opacity-50" disabled>&lt;</button>
             <button className="w-8 h-8 flex items-center justify-center rounded border border-indigo-600 bg-indigo-600 text-white font-bold">1</button>
             <button className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 bg-white text-slate-600 font-bold hover:bg-slate-50 transition-colors">&gt;</button>
           </div>
        </div>
      </div>

      {/* Add User Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl shadow-indigo-200/50 max-h-[90vh] overflow-y-auto"
            >
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">
                  {createdUser 
                    ? 'تم إنشاء الحساب بنجاح' 
                    : modalMode === 'add' 
                      ? 'إضافة مستخدم جديد' 
                      : 'تعديل بيانات المستخدم'}
                </h3>
                <button 
                  onClick={closeModal}
                  disabled={isSubmitting}
                  className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {createdUser ? (
                <div className="p-8 space-y-6 text-center">
                  <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
                    <UserCheck size={32} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-slate-500 font-medium">يرجى نسخ بيانات الدخول التالية وتسليمها للموظف:</p>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-6 space-y-4 border border-slate-100 text-right">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">البريد الإلكتروني</label>
                      <div className="font-mono text-sm font-bold text-slate-700 break-all select-all">{createdUser.email}</div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">كلمة المرور المؤقتة</label>
                      <div className="font-mono text-lg font-black text-indigo-600 select-all">{createdUser.password}</div>
                    </div>
                  </div>
                  <button 
                    onClick={closeModal}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-colors shadow-xl"
                  >
                    إغلاق والعودة للقائمة
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSaveUser} className="p-8 space-y-5">
                  {errorMsg && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2"
                    >
                      <div className="w-1.5 h-1.5 bg-red-600 rounded-full" />
                      {errorMsg}
                    </motion.div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">الاسم الكامل</label>
                    <input 
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="مثال: أحمد محمد"
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-700"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">البريد الإلكتروني</label>
                    <input 
                      required
                      type="email"
                      value={formData.email}
                      disabled={modalMode === 'edit'}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      placeholder="ahmed@example.com"
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-700 disabled:opacity-50"
                    />
                  </div>

                  {modalMode === 'add' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">كلمة المرور المؤقتة</label>
                      <div className="flex gap-2">
                        <input 
                          required
                          type="text"
                          value={formData.password}
                          onChange={(e) => setFormData({...formData, password: e.target.value})}
                          placeholder="أدخل أو ولد كلمة مرور"
                          className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono font-bold text-indigo-600"
                        />
                        <button 
                          type="button"
                          onClick={generatePassword}
                          className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                        >
                          توليد
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">رقم الهاتف</label>
                    <input 
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      placeholder="05xxxxxxx"
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">معرف تيليجرام</label>
                    <input 
                      type="text"
                      value={formData.telegramChatId}
                      onChange={(e) => setFormData({...formData, telegramChatId: e.target.value})}
                      placeholder="مثال: 123456789"
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                      dir="ltr"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">الدور الوظيفي</label>
                      <select 
                        value={formData.role}
                        onChange={(e) => setFormData({...formData, role: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700"
                      >
                        <option value="admin">مدير النظام</option>
                        <option value="company_manager">مدير الشركة</option>
                        <option value="company_assistant">مساعد الشركة</option>
                        <option value="law_manager">مدير المكتب القانوني</option>
                        <option value="law_assistant">مساعد قانوني</option>
                        <option value="employee">موظف</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">الحالة</label>
                      <div className="flex h-[50px] items-center">
                        <label className="relative flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={formData.isActive}
                            onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                          <span className="mr-3 text-sm font-bold text-slate-600 uppercase tracking-tighter">
                            {formData.isActive ? 'نشط' : 'معطل'}
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button 
                      type="button"
                      onClick={closeModal}
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-colors disabled:opacity-50"
                    >
                      إلغاء
                    </button>
                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-[2] px-4 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>جاري الحفظ...</span>
                        </>
                      ) : (
                        modalMode === 'add' ? 'إنشاء المستخدم' : 'حفظ التعديلات'
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setIsDeleteModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 text-center max-h-[90vh] overflow-y-auto"
            >
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">تأكيد حذف المستخدم</h3>
              <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                هل أنت متأكد من حذف هذا المستخدم؟ سيؤدي هذا إلى حذف بياناته من قاعدة البيانات نهائياً.
                <br />
                <span className="text-red-500 font-bold mt-2 block">ملاحظة: حذف الحساب من Firebase Auth يتطلب إجراءً يدوياً أو عبر لوحة التحكم.</span>
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                  إلغاء
                </button>
                <button 
                  onClick={handleDeleteUser}
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تأكيد الحذف'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Password Reset Success Modal */}
      <AnimatePresence>
        {resetModalOpen && resetUser && (
          <PasswordResetModal
            user={resetUser}
            newPassword={newGeneratedPassword}
            telegramStatus={telegramStatus}
            onSendTelegramRetry={async () => {
              if (resetUser && newGeneratedPassword) {
                await sendPasswordTelegramMessage(resetUser, newGeneratedPassword);
              }
            }}
            onClose={() => {
              setResetModalOpen(false);
              setResetUser(null);
              setNewGeneratedPassword('');
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

