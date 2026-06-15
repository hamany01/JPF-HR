import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { db, auth, functions } from '../lib/firebase';
import { UserProfile as UserType } from '../types/user';
import { useAuth } from '../hooks/useAuth';
import { Edit, Trash2, UserPlus, X, KeyRound, Copy, Check, Loader2, AlertTriangle, UserCheck, UserX } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { generateSecurePassword } from '../utils/passwordGenerator';
import { httpsCallable } from 'firebase/functions';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { initializeApp } from 'firebase/app';
import firebaseConfig from '../../firebase-applet-config.json';

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdUser, setCreatedUser] = useState<{ email: string; password: string } | null>(null);
  const { profile, isAdmin } = useAuth();
  
  // Password Reset State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordResetData, setPasswordResetData] = useState<{
    user: UserType;
    newPassword: string;
    telegramSuccess: boolean;
    telegramError?: string;
  } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'company_manager' as UserType['role'],
    telegramChatId: '',
    isActive: true
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      console.log('📡 Fetching users from firestore...');
      const querySnapshot = await getDocs(collection(db, 'users'));
      const userData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          uid: doc.id, // Ensure both 'id' and 'uid' are present to avoid any undefined access
          ...data
        } as UserType;
      });
      setUsers(userData);
      console.log('✅ Users fetched successfully:', userData.length);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error('فشل جلب قائمة الموظفين');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const generatePassword = () => {
    const pass = generateSecurePassword();
    setFormData(prev => ({ ...prev, password: pass }));
  };

  const openAddModal = () => {
    setModalMode('add');
    setSelectedUserId(null);
    setCreatedUser(null);
    setErrorMsg(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      password: '',
      role: 'company_manager',
      telegramChatId: '',
      isActive: true
    });
    setIsModalOpen(true);
  };

  const openEditModal = (user: UserType) => {
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
      role: user.role || 'company_manager',
      isActive: user.isActive ?? true
    });
    setIsModalOpen(true);
  };

  const confirmDelete = (user: UserType) => {
    setSelectedUserId(user.id);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!isAdmin || !selectedUserId) {
      toast.error('غير مصرح بإجراء هذه العملية');
      return;
    }
    setIsSubmitting(true);
    try {
      console.log('🗑️ Deleting user:', selectedUserId);
      await deleteDoc(doc(db, 'users', selectedUserId));
      setIsDeleteModalOpen(false);
      toast.success('تم حذف الموظف من قاعدة البيانات بنجاح');
      fetchUsers();
    } catch (error) {
      console.error('Delete user failed:', error);
      toast.error('فشل حذف المستخدم');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStatus = async (user: UserType) => {
    if (!isAdmin) {
      toast.error('عذراً، لا تملك صلاحية تعديل حالة المستخدمين');
      return;
    }
    const toastId = toast.loading('جاري تحديث مفعول الحساب...');
    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, {
        isActive: !user.isActive,
        updatedAt: serverTimestamp(),
      });
      toast.success(`تم ${!user.isActive ? 'تفعيل' : 'تعطيل'} حساب الموظف بنجاح`, { id: toastId });
      fetchUsers();
    } catch (error) {
      console.error('Error toggling active status:', error);
      toast.error('فشل تحديث الحالة', { id: toastId });
    }
  };

  const changeRole = async (user: UserType, newRole: string) => {
    if (!isAdmin) {
      toast.error('عذراً، لا تملك صلاحية تعديل الأدوار');
      return;
    }
    const toastId = toast.loading('جاري تغيير صلاحيات الدور...');
    try {
      const userRef = doc(db, 'users', user.id);
      const updatePayload: any = {
        role: newRole,
        updatedAt: serverTimestamp(),
      };
      if (newRole === 'law_manager') {
        updatePayload.lawFirmId = "LAW-JPF-001";
      }
      await updateDoc(userRef, updatePayload);
      toast.success('تم تحديث صلاحية الموظف بنجاح', { id: toastId });
      fetchUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('فشل تحديث الدور', { id: toastId });
    }
  };

  const sendPasswordViaTelegram = async (
    telegramChatId: string,
    userName: string,
    newPassword: string
  ) => {
    const TELEGRAM_BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
    
    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error('Telegram Bot Token غير مهيأ في البيئة المحيطة');
    }

    const message = `
🔐 <b>إعادة تعيين كلمة المرور - JPF HR</b>

مرحباً <b>${userName}</b>،

تمت إعادة تعيين كلمة المرور الخاصة بك بنجاح في نظام JPF-HR.

📧 <b>البريد الإلكتروني:</b> <code>لم يتم التغيير</code>
🔑 <b>كلمة المرور الجديدة:</b> <code>${newPassword}</code>

⚠️ يُنصح بشدة بتسجيل الدخول وتغيير كلمة المرور من لوحة التحكم في صفحة "الملف الشخصي" لحماية حسابك الاستراتيجي.

• <b>تاريخ العملية:</b> ${new Date().toLocaleDateString('ar-SA')}
• JPF-HR 🦾
    `.trim();

    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: message,
          parse_mode: 'HTML'
        })
      }
    );

    if (!response.ok) {
      const errJson = await response.json();
      throw new Error(errJson.description || 'فشل إرسال رسالة Telegram');
    }

    return response.json();
  };

  const handleResetPassword = async (user: UserType) => {
    console.log('🔑 handleResetPassword called for:', user.name);
    
    if (!isAdmin) {
      toast.error('عذراً، صلاحية إعادة تعيين كلمة المرور مخصصة للأدمن فقط');
      return;
    }

    const confirmed = window.confirm(
      `هل أنت متأكد من إعادة توليد كلمة المرور للموظف: ${user.name}؟`
    );
    
    if (!confirmed) {
      console.log('❌ User cancelled');
      return;
    }

    const toastId = toast.loading('جاري توليد كلمة مرور جديدة...');

    try {
      console.log('📝 Generating secure password...');
      const newPassword = generateSecurePassword();
      console.log('✅ Password generated successfully');

      console.log('☁️ Calling local API resetUserPassword...');
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('يجب تسجيل الدخول أولاً');
      }
      
      const idToken = await currentUser.getIdToken();
      
      const response = await fetch('/api/resetUserPassword', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          userId: user.id || user.uid,
          newPassword: newPassword
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل في إعادة تعيين كلمة المرور');
      }

      const result = await response.json();
      console.log('✅ Local API result:', result);

      let telegramSuccess = false;
      let telegramError = '';

      if (user.telegramChatId) {
        console.log('📱 Attempting to send Telegram notification to:', user.telegramChatId);
        try {
          await sendPasswordViaTelegram(user.telegramChatId, user.name, newPassword);
          telegramSuccess = true;
          console.log('✅ Telegram sent successfully');
        } catch (error: any) {
          telegramError = error.message || 'فشل إرسال Telegram';
          console.error('❌ Telegram failed:', telegramError);
        }
      }

      console.log('✅ Setting password modal data...');
      setPasswordResetData({
        user,
        newPassword,
        telegramSuccess,
        telegramError
      });
      setShowPasswordModal(true);

      toast.success('تمت إعادة توليد كلمة المرور بنجاح وتسجيل العملية', { id: toastId });

    } catch (error: any) {
      console.error('❌ Error inside handleResetPassword:', error);
      
      const isInternalOrCors = 
        error?.code === 'internal' || 
        error?.code === 'functions/internal' ||
        error?.message?.toLowerCase().includes('internal') || 
        error?.message?.toLowerCase().includes('cors') || 
        error?.message?.toLowerCase().includes('fetch') ||
        error?.message?.toLowerCase().includes('failed to fetch');

      if (isInternalOrCors) {
        toast.error(
          `فشل إعادة التعيين (internal / CORS): الدالة Cloud Function غير منشورة أو غير متصلة في مشروع Firebase. يرجى نشرها أولاً باستخدام أمر: \n'firebase deploy --only functions:resetUserPassword'`,
          { id: toastId, duration: 8000 }
        );
      } else {
        toast.error(`فشل إعادة تعيين كلمة المرور: ${error.message || 'يرجى التحقق من الخادم وسجلات Cloud Function.'}`, { id: toastId });
      }
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (modalMode === 'add') {
        console.log('➕ Creating a new user via secondary authentication interface...');
        // إنشاء مستخدم جديد يتطلب استخدام تطبيق ثنائي ثانوي لتهيئة الحساب دون تسجيل خروج الأدمن الحالي
        const secondaryAppName = `secondary-app-${Date.now()}`;
        const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
        const secondaryAuth = getAuth(secondaryApp);
        
        const userCredential = await createUserWithEmailAndPassword(
          secondaryAuth, 
          formData.email, 
          formData.password
        );
        const newUserId = userCredential.user.uid;

        console.log('📝 Writing profile to Firestore for new user uid:', newUserId);
        const userPayload: any = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone || "",
          role: formData.role,
          isActive: formData.isActive,
          telegramChatId: formData.telegramChatId || "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (formData.role === 'law_manager') {
          userPayload.lawFirmId = "LAW-JPF-001";
        }
        await setDoc(doc(db, 'users', newUserId), userPayload);

        // تسجيل الخروج من التطبيق الثانوي المؤقت لتفادي التسجيلات المزدوجة
        await signOut(secondaryAuth);
        setCreatedUser({ email: formData.email, password: formData.password });
        toast.success('تم إنشاء حساب الموظف الإداري بنجاح');
      } else {
        // تعديل البيانات بصفة محددة
        if (!selectedUserId) return;
        console.log('📝 Modifying existing user profile for id:', selectedUserId);
        const userRef = doc(db, 'users', selectedUserId);
        const updatePayload: any = {
          name: formData.name,
          phone: formData.phone || "",
          telegramChatId: formData.telegramChatId || "",
          role: formData.role,
          isActive: formData.isActive,
          updatedAt: serverTimestamp(),
        };
        if (formData.role === 'law_manager') {
          updatePayload.lawFirmId = "LAW-JPF-001";
        }
        await updateDoc(userRef, updatePayload);
        setIsModalOpen(false);
        toast.success('تم حفظ التعديلات بنجاح');
      }
      
      setFormData({ name: '', email: '', phone: '', telegramChatId: '', password: '', role: 'company_manager', isActive: true });
      fetchUsers();
    } catch (error: any) {
      console.error("Error saving user:", error);
      let message = "حدث خطأ غير متوقع أثناء الحفظ";
      if (error.code === 'auth/email-already-in-use') message = "البريد الإلكتروني مستخدم مسبقاً من قِبل موظف آخر";
      if (error.code === 'auth/invalid-email') message = "البريد الإلكتروني غير صالح من الناحية الفنية";
      if (error.code === 'auth/weak-password') message = "كلمة المرور ضعيفة للغاية؛ يجب أن تفوق 6 خانات";
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
    setFormData({ name: '', email: '', phone: '', password: '', role: 'company_manager', telegramChatId: '', isActive: true });
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      <div className="text-slate-500 font-medium font-sans">جاري التحميل المباشر...</div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fadeIn" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">إدارة المستخدمين والموظفين</h1>
          <p className="text-slate-500 text-sm font-medium">التحكم في الصلاحيات، الفعالية، ومهام تسيير العمل بالنظام.</p>
        </div>
        <div className="flex gap-2.5">
          <button 
            onClick={openAddModal}
            disabled={!isAdmin}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all hover:scale-[1.02] shadow-lg shadow-indigo-150 disabled:opacity-50 disabled:shadow-none"
          >
            <UserPlus size={18} />
            <span>إضافة مستخدم جديد</span>
          </button>
        </div>
      </div>

      {/* Users Database Table Card */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden text-sm">
        <div className="p-5 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
          <span className="font-bold text-slate-700">دليل المستخدمين المعتمدين والموظفين</span>
          <span className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-bold">إجمالي: {users.length}</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead className="bg-slate-50/50 text-slate-500 tracking-tight text-[11px] font-black border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-black tracking-wider text-right">الاسم والبريد الإلكتروني</th>
                <th className="px-6 py-4 font-black tracking-wider text-right">الدور والصلاحيات والوظيفة</th>
                <th className="px-6 py-4 font-black tracking-wider text-right">مستوى وحالة الفعالية</th>
                <th className="px-6 py-4 font-black tracking-wider text-right">معرّف Telegram</th>
                <th className="px-6 py-4 font-black tracking-wider text-left">التحكم والإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/40 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-extrabold text-slate-900 text-sm">{user.name}</span>
                      <span className="text-slate-400 font-medium font-sans text-xs mt-0.5">{user.email}</span>
                      {user.phone && <span className="text-slate-400 text-[10px] mt-0.5">{user.phone}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <select 
                      value={user.role} 
                      disabled={!isAdmin}
                      onChange={(e) => changeRole(user, e.target.value as UserType['role'])}
                      className="bg-slate-50 border border-slate-150 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none disabled:opacity-60 transition-all font-sans"
                    >
                      <option value="admin">مدير النظام (Admin)</option>
                      <option value="company_manager">مدير الشركة (Company Manager)</option>
                      <option value="law_manager">مدير المكتب القانوني (Law Office Manager)</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <div className={cn(
                      "flex items-center gap-2 text-xs font-bold",
                      user.isActive ? "text-emerald-600" : "text-slate-400"
                    )}>
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        user.isActive ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                      )} />
                      <span>{user.isActive ? 'نشط بالنظام' : 'حساب معطل'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-mono text-xs font-bold">
                    {user.telegramChatId ? (
                      <span className="bg-sky-50 text-sky-700 px-2.5 py-1 rounded-lg text-[11px] font-sans font-bold">
                        {user.telegramChatId}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-left">
                    <div className="flex items-center justify-start gap-2" dir="ltr">
                      {/* زر التعديل */}
                      <button 
                        onClick={() => openEditModal(user)}
                        disabled={!isAdmin}
                        title="تعديل حساب المستخدم"
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all disabled:opacity-40"
                      >
                        <Edit size={16} />
                      </button>

                      {/* زر إعادة توليد كلمة المرور - للأدمن فقط */}
                      {isAdmin && (
                        <button 
                          onClick={() => {
                            console.log('🔑 Reset Password button clicked for:', user.name);
                            handleResetPassword(user);
                          }}
                          title="إعادة توليد كلمة المرور آلياً"
                          className="p-2 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-xl transition-all disabled:opacity-40"
                        >
                          <KeyRound size={16} />
                        </button>
                      )}

                      {/* زر تعطيل/تفعيل */}
                      <button 
                        onClick={() => toggleStatus(user)}
                        disabled={!isAdmin}
                        title={user.isActive ? 'تعطيل الحساب مؤقتاً' : 'تفعيل الحساب'}
                        className={cn(
                          "p-2 rounded-xl transition-all disabled:opacity-40",
                          user.isActive 
                            ? "text-slate-400 hover:text-orange-600 hover:bg-orange-50" 
                            : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                        )}
                      >
                        {user.isActive ? <UserX size={16} /> : <UserCheck size={16} />}
                      </button>

                      {/* زر الحذف */}
                      <button 
                        onClick={() => confirmDelete(user)}
                        disabled={!isAdmin || profile?.id === user.id}
                        title="حذف الحساب نهائياً من السيستم"
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all disabled:opacity-40"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Form Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto border border-slate-100"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-indigo-600" />
                  {createdUser 
                    ? 'بيانات التسجيل والحساب الجديد' 
                    : modalMode === 'add' 
                      ? 'إضافة وحفظ موظف جديد' 
                      : 'تعديل البيانات الأساسية للنظام'}
                </h3>
                <button 
                  onClick={closeModal}
                  disabled={isSubmitting}
                  className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {createdUser ? (
                <div className="space-y-6 text-center py-4">
                  <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2 border border-emerald-100">
                    <UserCheck size={28} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-slate-900 font-extrabold text-sm">تم إنشاء حساب الموظف الإداري بنجاح</p>
                    <p className="text-slate-500 font-medium text-xs">يرجى نسخ وحفظ هذه البيانات فوراً لتسليمها للموظف:</p>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-5 space-y-4 border border-slate-100 text-right font-sans">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 block tracking-wider uppercase">البريد الإلكتروني للقرصنة والتوجيه</label>
                      <div className="font-mono text-xs font-bold text-slate-700 bg-white border border-slate-100 p-2.5 rounded-lg select-all text-center">{createdUser.email}</div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 block tracking-wider uppercase">كلمة المرور المؤقتة للتسجيل الأول</label>
                      <div className="font-mono text-base font-black text-indigo-600 bg-indigo-50/50 border border-indigo-100/50 p-2.5 rounded-lg select-all text-center tracking-wider">{createdUser.password}</div>
                    </div>
                  </div>
                  <button 
                    onClick={closeModal}
                    className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-xl"
                  >
                    مفهوم، إغلاق والعودة للقائمة
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSaveUser} className="space-y-4">
                  {errorMsg && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-xs font-extrabold flex items-center gap-2"
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{errorMsg}</span>
                    </motion.div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 mr-1">الاسم الكامل المميز</label>
                    <input 
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="مثال: المهندس عبدالرحمن"
                      className="w-full bg-slate-50 border border-slate-150 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all font-medium text-slate-700 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 mr-1">البريد الإلكتروني المهني</label>
                    <input 
                      required
                      type="email"
                      value={formData.email}
                      disabled={modalMode === 'edit'}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      placeholder="jpf@company.com"
                      className="w-full bg-slate-50 border border-slate-150 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all font-medium text-slate-700 text-xs disabled:opacity-50"
                    />
                  </div>

                  {modalMode === 'add' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 mr-1">كلمة المرور الابتدائية</label>
                      <div className="flex gap-2">
                        <input 
                          required
                          type="text"
                          value={formData.password}
                          onChange={(e) => setFormData({...formData, password: e.target.value})}
                          placeholder="أدخل أو توليد كلمة مرور عشوائية"
                          className="flex-1 bg-slate-50 border border-slate-150 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all font-mono font-bold text-indigo-600 text-xs tracking-wider"
                        />
                        <button 
                          type="button"
                          onClick={generatePassword}
                          className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm shrink-0"
                        >
                          توليد آلي
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 mr-1">رقم جوال الموظف الكفيل</label>
                    <input 
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      placeholder="05xxxxxxx"
                      className="w-full bg-slate-50 border border-slate-150 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all font-medium text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 mr-1">معرّف تواصل Telegram Chat ID</label>
                    <input 
                      type="text"
                      value={formData.telegramChatId}
                      onChange={(e) => setFormData({...formData, telegramChatId: e.target.value})}
                      placeholder="مثال: 5628104829"
                      className="w-full bg-slate-50 border border-slate-150 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all font-medium text-xs text-left"
                      dir="ltr"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 mr-1">الدور الوظيفي والصلاحيات</label>
                      <select 
                        value={formData.role}
                        onChange={(e) => setFormData({...formData, role: e.target.value as UserType['role']})}
                        className="w-full bg-slate-50 border border-slate-150 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all font-bold text-slate-700 text-xs"
                      >
                        <option value="admin">مدير النظام (Admin)</option>
                        <option value="company_manager">مدير الشركة (Company Manager)</option>
                        <option value="law_manager">مدير المكتب القانوني (Law Office Manager)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 mr-1">حالة مفعول الحساب</label>
                      <div className="flex h-[42px] items-center">
                        <label className="relative flex items-center cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={formData.isActive}
                            onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                          <span className="mr-3 text-xs font-bold text-slate-600">
                            {formData.isActive ? 'مفعّل ونشط جداً' : 'معطّل مؤقتاً'}
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="pt-5 border-t border-slate-100 flex gap-3">
                    <button 
                      type="button"
                      onClick={closeModal}
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-3 bg-slate-105 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors disabled:opacity-50 text-xs"
                    >
                      إلغاء الإجراء
                    </button>
                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-[2] px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs shadow-lg shadow-indigo-100"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>جاري الحفظ الآمن...</span>
                        </>
                      ) : (
                        modalMode === 'add' ? 'حفظ وإنشاء الحساب' : 'تحديث بيانات الملف'
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 text-center border border-slate-100"
            >
              <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
                <AlertTriangle size={28} />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-2 font-sans">تأكيد حذف الملف نهائياً</h3>
              <p className="text-slate-500 text-xs mb-6 leading-relaxed">
                هل أنت متأكد من رغبتك الفعلية في حذف حساب الموظف؟ هذا سيؤدي إلى فقدان الملف التاريخي والبيانات من Firestore نهائياً.
              </p>
              
              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors disabled:opacity-50 text-xs"
                >
                  تراجع عن الإجراء
                </button>
                <button 
                  onClick={handleDeleteUser}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs shadow-lg shadow-red-100"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'نعم، قم بالحذف'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Interactive Password Reset Success Modal */}
      <AnimatePresence>
        {showPasswordModal && passwordResetData && (
          <PasswordResetModal
            data={passwordResetData}
            onClose={() => {
              setShowPasswordModal(false);
              setPasswordResetData(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// مكون PasswordResetModal الداخلي المتفاعل
function PasswordResetModal({ 
  data, 
  onClose 
}: { 
  data: { 
    user: UserType; 
    newPassword: string; 
    telegramSuccess: boolean; 
    telegramError?: string 
  }; 
  onClose: () => void 
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(data.newPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('تم نسخ كلمة المرور المحدثة بنجاح للحافظة');
    } catch (error) {
      toast.error('فشل عملية النسخ، يرجى نسخها يدوياً');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto border border-slate-100 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-100 shadow-sm shadow-emerald-50">
            <Check className="w-8 h-8 animate-bounce" />
          </div>
          <h3 className="text-lg font-black text-slate-900 mb-1">
            تمت إعادة توليد كلمة المرور بنجاح
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            تحديث الحساب الخاص بالموظف: <span className="font-extrabold text-slate-700">{data.user.name}</span>
          </p>
        </div>

        <div className="bg-slate-50/80 border border-slate-100 rounded-2xl p-5 mb-4 font-sans">
          <p className="text-xs text-slate-400 font-bold mb-2">كلمة المرور المشفرة والجديدة بالكامل:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white px-3 py-2.5 rounded-xl border border-slate-200 font-mono text-base text-center select-all font-black text-indigo-600 tracking-wider">
              {data.newPassword}
            </code>
            <button
              onClick={handleCopy}
              className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shrink-0"
              title="نسخ الحافظة"
            >
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {data.user.telegramChatId ? (
          <div className={cn(
            "p-4 rounded-2xl text-xs font-bold leading-relaxed mb-4 border",
            data.telegramSuccess 
              ? 'bg-sky-50 border-sky-100 text-sky-800' 
              : 'bg-amber-50 border-amber-100 text-amber-800'
          )}>
            <p>
              {data.telegramSuccess 
                ? '✅ تم إرسال كلمة المرور المحدثة تلقائياً لمعرّف كفيل الموظف عبر Telegram بنجاح.' 
                : `⚠️ تعذّر الإرسال عبر Telegram: ${data.telegramError || 'لا توجد استجابة كافية من البوت'}`
              }
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-2xl text-xs font-bold bg-slate-50 border border-slate-100 text-slate-500 leading-relaxed mb-4">
            ℹ️ لم يتم تحديد معرّف محادثة هاتفية (Telegram Chat ID) لهذا الموظف، لذا يتعين تزويده بكلمة المرور بالوسائل التقليدية المتاحة يدوياً.
          </div>
        )}

        <div className="bg-amber-55 border border-amber-50 hover:bg-amber-50/20 bg-amber-50/30 rounded-2xl p-4 mb-6 text-xs text-amber-800 font-bold leading-tight flex gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
          <span>تنبيه أمني: احرص على حماية وتوصيل كلمات المرور بصفة مستقلة وآمنة لتفادي عمليات الاختراق الخارجي.</span>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-transform hover:scale-[1.01]"
        >
          تمت المعاينة والانتهاء
        </button>
      </div>
    </div>
  );
}
