import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db, auth } from '../../firebase/config';
import { Loader2, Plus, Trash2, Save, Upload, Download, Database, ShieldAlert, CheckCircle } from 'lucide-react';

export default function GeneralExecutionSettings() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [exportingDb, setExportingDb] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [settings, setSettings] = useState({
    transactionTypes: [] as string[],
    idTypes: [] as string[]
  });

  const [newTransactionType, setNewTransactionType] = useState('');
  const [newIdType, setNewIdType] = useState('');
  const [logoBase64, setLogoBase64] = useState<string>('');
  const [resettingDb, setResettingDb] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [confirmText, setResetConfirmText] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);

  const handleResetTransactionalData = async () => {
    if (confirmText.trim() !== 'مسح البيانات') {
      alert('يرجى كتابة كلمة "مسح البيانات" للتأكيد');
      return;
    }

    setResettingDb(true);
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const res = await fetch('/api/reset-transactional-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      const data = await res.json();

      if (data.success) {
        setResetSuccess(true);
        setShowResetModal(false);
        setResetConfirmText('');
        alert(`تم تفريغ النظام بنجاح! إجمالي السجلات الممسوحة: ${data.totalDeleted}`);
      } else {
        alert(`فشلت العملية: ${data.error || 'خطأ غير معروف'}`);
      }
    } catch (err: any) {
      alert(`خطأ في خادم النظام: ${err.message}`);
    }
    setResettingDb(false);
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      // 1. جلب إعدادات المعاملات
      const docRef = doc(db, 'settings', 'execution');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSettings({
          transactionTypes: data.transactionTypes || ["سند لأمر إلكتروني", "سند لأمر ورقي", "كمبيالة", "عقد"],
          idTypes: data.idTypes || ["فرد", "مؤسسة", "شركة"]
        });
      } else {
        const defaults = {
          transactionTypes: ["سند لأمر إلكتروني", "سند لأمر ورقي", "كمبيالة", "عقد"],
          idTypes: ["فرد", "مؤسسة", "شركة"]
        };
        await setDoc(docRef, defaults, { merge: true });
        setSettings(defaults);
      }

      // 2. جلب الشعار المخصص (اللوجو) من مستند المظهر
      const appearanceRef = doc(db, 'settings', 'appearance');
      const appearanceSnap = await getDoc(appearanceRef);
      if (appearanceSnap.exists()) {
        setLogoBase64(appearanceSnap.data().logoBase64 || '');
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleAddTransactionType = () => {
    if (!newTransactionType.trim()) return;
    if (settings.transactionTypes.includes(newTransactionType.trim())) return;
    setSettings({ ...settings, transactionTypes: [...settings.transactionTypes, newTransactionType.trim()] });
    setNewTransactionType('');
  };

  const handleAddIdType = () => {
    if (!newIdType.trim()) return;
    if (settings.idTypes.includes(newIdType.trim())) return;
    setSettings({ ...settings, idTypes: [...settings.idTypes, newIdType.trim()] });
    setNewIdType('');
  };

  const removeItem = (key: 'transactionTypes' | 'idTypes', index: number) => {
    const updated = [...settings[key]];
    updated.splice(index, 1);
    setSettings({ ...settings, [key]: updated });
  };

  // معالجة ورفع اللوجو وتحويله للـ Base64 مضغوط ومحسن
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // التأكد من حجم الملف (تنبيه إذا كان أكبر من 3 ميجا قبل الضغط)
    if (file.size > 3 * 1024 * 1024) {
      alert("حجم الملف كبير جداً، يرجى اختيار صورة أصغر من 3 ميجابايت.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // تحسين أبعاد اللوجو: الحد الأقصى للعرض 450 بكسل ليكون خفيفاً وسريع التنزيل
        const MAX_WIDTH = 450;
        if (width > MAX_WIDTH) {
          height = (MAX_WIDTH / width) * height;
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // تحويله لـ PNG مضغوط بجودة ممتازة
          const compressedBase64 = canvas.toDataURL('image/png', 0.9);
          setLogoBase64(compressedBase64);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleClearLogo = () => {
    setLogoBase64('');
  };

  const handleExportDatabase = async () => {
    setExportingDb(true);
    setExportSuccess(false);
    try {
      const collectionsToExport = [
        'cases',
        'requests',
        'payment_plans',
        'case_sessions',
        'appEvents',
        'users',
        'roles_permissions',
        'notificationRules',
        'notificationLogs',
        'settings'
      ];

      const exportedData: Record<string, any[]> = {};
      let totalRecords = 0;

      for (const colName of collectionsToExport) {
        try {
          const snapshot = await getDocs(collection(db, colName));
          const docsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          exportedData[colName] = docsData;
          totalRecords += docsData.length;
        } catch (e) {
          console.warn(`Could not export collection ${colName}:`, e);
          exportedData[colName] = [];
        }
      }

      const backupData = {
        exportTimestamp: new Date().toISOString(),
        system: "JPF Legal & Execution System",
        totalCollections: Object.keys(exportedData).length,
        totalRecords,
        collections: exportedData
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jpf_database_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 5000);
    } catch (err: any) {
      alert(`خطأ أثناء تصدير نسخة قاعدة البيانات: ${err.message}`);
    }
    setExportingDb(false);
  };

  const saveSettings = async () => {
    setSubmitting(true);
    try {
      // 1. حفظ إعدادات المعاملات
      const executionRef = doc(db, 'settings', 'execution');
      await setDoc(executionRef, settings, { merge: true });

      // 2. حفظ الشعار الجديد في مستند المظهر
      const appearanceRef = doc(db, 'settings', 'appearance');
      await setDoc(appearanceRef, { logoBase64: logoBase64 }, { merge: true });

      // تحديث الـ localStorage للوجو في المتصفح الحالي للتطبيق بشكل فوري
      if (logoBase64) {
        localStorage.setItem('jpf_custom_logo', logoBase64);
      } else {
        localStorage.removeItem('jpf_custom_logo');
      }

      alert('تم حفظ الإعدادات والشعار بنجاح!');
      // تحديث الصفحة تلقائياً لتطبيق اللوجو في الشريط الجانبي وكل واجهات الموقع فوراً
      window.location.reload();
    } catch (error: any) {
      alert(`خطأ في الحفظ: ${error.message}`);
    }
    setSubmitting(false);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 gap-4">
      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      <div className="text-slate-500 font-medium">جاري تحميل الإعدادات...</div>
    </div>
  );

  return (
    <div className="space-y-12 animate-in fade-in duration-500" dir="rtl">
      {/* قسم النسخ الاحتياطي وتصدير قاعدة البيانات */}
      <section className="space-y-6 bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs uppercase tracking-widest">
              <Database size={16} />
              <span>إدارة النسخ الاحتياطي لقاعدة البيانات</span>
            </div>
            <h2 className="text-2xl font-black text-white">تصدير كافة بيانات النظام (JSON)</h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              احصل فوراً على نسخة احتياطية شاملة بصيغة JSON تحتوي على جميع مجموعات البيانات: الطلبات، القضايا، الجلسات، خطط الدفع، المستخدمين، الصلاحيات، وإعدادات النظام.
            </p>
          </div>

          <div className="flex flex-col gap-3 shrink-0">
            <button
              type="button"
              onClick={handleExportDatabase}
              disabled={exportingDb}
              className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-3 active:scale-95 text-base cursor-pointer disabled:opacity-50"
            >
              {exportingDb ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download size={20} />}
              <span>تنزيل النسخة الاحتياطية الان</span>
            </button>
            {exportSuccess && (
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold justify-center bg-emerald-950/50 py-2 px-4 rounded-xl border border-emerald-500/30">
                <CheckCircle size={14} />
                <span>تم تجهيز وتنزيل الملف بنجاح!</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-medium text-slate-400">
          <div className="flex items-center gap-2 bg-slate-800/50 p-3 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
            <span>القضايا (cases)</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-800/50 p-3 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
            <span>الطلبات (requests)</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-800/50 p-3 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
            <span>الجلسات والدفعات</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-800/50 p-3 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
            <span>المستخدمين والإعدادات</span>
          </div>
        </div>
      </section>

      {/* قسم منطقة الخطر - مسح البيانات التجريبية والبدء الفعلي */}
      <section className="space-y-6 bg-red-50/70 border border-red-200/80 p-8 rounded-[2.5rem] shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2 text-red-600 font-bold text-xs uppercase tracking-widest">
              <ShieldAlert size={18} />
              <span>منطقة الخطر - تصفير بيئة العمل</span>
            </div>
            <h2 className="text-2xl font-black text-red-950">مسح البيانات التجريبية والبدء الفعلي</h2>
            <p className="text-sm text-red-800 leading-relaxed">
              سيتم تفريغ كافة الطلبات والقضايا والجلسات والدفعات والسجلات التجريبية، مع <strong className="font-black text-red-950">الحفاظ الكامل على حسابات المستخدمين وصلاحياتهم وإعدادات النظام وشعاره</strong>.
            </p>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black shadow-lg shadow-red-200 transition-all flex items-center justify-center gap-3 active:scale-95 text-base cursor-pointer"
            >
              <Trash2 size={20} />
              <span>مسح البيانات التجريبية الآن</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold pt-4 border-t border-red-200/60">
          <div className="bg-white/80 p-3.5 rounded-xl border border-red-100 text-red-900">
            <span className="block text-[11px] font-black text-red-500 mb-1">❌ ما سيتم مسحه:</span>
            سجلات الطلبات (16) • الملفات والقضايا (28) • الجلسات والدفعات • الأرشيف والأحداث.
          </div>
          <div className="bg-white/80 p-3.5 rounded-xl border border-emerald-100 text-emerald-900">
            <span className="block text-[11px] font-black text-emerald-600 mb-1">✅ ما سيتم الحفاظ عليه:</span>
            حسابات المستخدمين والموظفين • الأدوار والصلاحيات • قواعد ربط التلجرام • الشعار والقوالب.
          </div>
        </div>
      </section>

      {/* Modal التأكيد لمسح البيانات */}
      {showResetModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-[2rem] max-w-md w-full p-8 space-y-6 shadow-2xl border border-slate-100">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-3 bg-red-100 rounded-2xl">
                <ShieldAlert size={28} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">تأكيد مسح البيانات</h3>
                <p className="text-xs text-slate-400 font-medium">إجراء حساس لا يمكن التراجع عنه</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed font-medium">
              تأكد من تنزيل النسخة الاحتياطية أولاً. لمتابعة العملية ومسح جميع القضايا والطلبات التجريبية، يرجى كتابة عبارة <strong className="text-red-600 font-black">"مسح البيانات"</strong> في الحقل أدناه:
            </p>

            <input
              type="text"
              value={confirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              placeholder="اكتب: مسح البيانات"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center font-black text-slate-800 outline-none focus:ring-2 focus:ring-red-500"
            />

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleResetTransactionalData}
                disabled={resettingDb || confirmText.trim() !== 'مسح البيانات'}
                className="flex-[2] py-3.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-xl font-black transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {resettingDb ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 size={18} />}
                <span>تأكيد المسح الآن</span>
              </button>
              <button
                type="button"
                onClick={() => { setShowResetModal(false); setResetConfirmText(''); }}
                disabled={resettingDb}
                className="flex-1 py-3.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl font-bold transition-all cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* قسم تعديل وتحميل شعار الموقع وهوية الشؤون القانونية */}
      <section className="space-y-6 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900">هوية وشعار النظام</h2>
          <p className="text-sm text-slate-500">تحميل شعار مخصص بديل في الهيدر والقائمة الجانبية وصفحة تسجيل الدخول</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          {/* صندوق رفع الملف والتحكم */}
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-6 transition-all text-center bg-white shadow-inner relative">
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleLogoUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center gap-3">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full">
                  <Upload size={24} />
                </div>
                <div>
                  <span className="text-sm font-black text-indigo-600">اضغط لرفع صورة الشعار</span>
                  <p className="text-xs text-slate-400 mt-1">يدعم PNG, JPG, WebP أو SVG (أقل من 3 ميجا)</p>
                </div>
              </div>
            </div>

            {logoBase64 && (
              <button 
                type="button"
                onClick={handleClearLogo}
                className="w-full py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2"
              >
                <Trash2 size={16} />
                إزالة الشعار المخصص والعودة للوضع الافتراضي
              </button>
            )}
          </div>

          {/* صندوق استعراض الشعار الحالي */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 flex flex-col items-center justify-center min-h-[160px] text-center shadow-sm">
            <span className="text-xs font-bold text-slate-400 mb-4 block">معاينة الشعار الحالي في النظام:</span>
            {logoBase64 ? (
              <div className="p-4 bg-slate-900 rounded-2xl flex items-center justify-center min-h-[100px] w-full max-w-[280px]">
                <img 
                  src={logoBase64} 
                  alt="Custom Logo Preview" 
                  className="max-h-16 max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="text-center py-4 space-y-3">
                <div className="p-4 bg-slate-900 rounded-2xl flex items-center justify-center min-h-[100px] w-full max-w-[280px] mx-auto opacity-50">
                  <img 
                    src="/logo.png" 
                    alt="Default Logo Preview" 
                    className="max-h-14 max-w-full object-contain"
                  />
                </div>
                <span className="text-xs font-semibold text-slate-500 block">يتم استخدام الشعار الافتراضي للنظام في السيرفر</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Transaction Types */}
      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-800">أنواع المعاملات</h2>
          <p className="text-sm text-slate-500">إدارة أنواع السندات والمعاملات المتاحة في الطلبات</p>
        </div>

        <div className="grid gap-3">
          {settings.transactionTypes.map((type, idx) => (
            <div key={idx} className="flex gap-2 group">
              <input 
                type="text"
                value={type}
                readOnly
                className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 shadow-sm"
              />
              <button 
                onClick={() => removeItem('transactionTypes', idx)}
                className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
              >
                <Trash2 size={20} />
              </button>
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <input 
              type="text"
              placeholder="إضافة نوع جديد..."
              value={newTransactionType}
              onChange={(e) => setNewTransactionType(e.target.value)}
              className="flex-1 bg-indigo-50/30 border border-indigo-100 rounded-xl px-4 py-3 font-bold text-slate-700"
            />
            <button 
              onClick={handleAddTransactionType}
              className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>
      </section>

      {/* ID Types */}
      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-800">أنواع الهويات</h2>
          <p className="text-sm text-slate-500">إدارة أنواع الهويات (فرد، مؤسسة، إلخ)</p>
        </div>

        <div className="grid gap-3">
          {settings.idTypes.map((type, idx) => (
            <div key={idx} className="flex gap-2 group">
              <input 
                type="text"
                value={type}
                readOnly
                className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 shadow-sm"
              />
              <button 
                onClick={() => removeItem('idTypes', idx)}
                className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
              >
                <Trash2 size={20} />
              </button>
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <input 
              type="text"
              placeholder="إضافة نوع هوية جديد..."
              value={newIdType}
              onChange={(e) => setNewIdType(e.target.value)}
              className="flex-1 bg-indigo-50/30 border border-indigo-100 rounded-xl px-4 py-3 font-bold text-slate-700"
            />
            <button 
              onClick={handleAddIdType}
              className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>
      </section>

      <div className="pt-6 border-t border-slate-100">
        <button 
          onClick={saveSettings}
          disabled={submitting}
          className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save size={20} />}
          حفظ التغييرات والشعار
        </button>
      </div>
    </div>
  );
}
