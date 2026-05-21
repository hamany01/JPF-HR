import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Loader2, Plus, Trash2, Save, Upload, RefreshCw } from 'lucide-react';

export default function GeneralExecutionSettings() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [settings, setSettings] = useState({
    transactionTypes: [] as string[],
    idTypes: [] as string[]
  });

  const [newTransactionType, setNewTransactionType] = useState('');
  const [newIdType, setNewIdType] = useState('');
  const [logoBase64, setLogoBase64] = useState<string>('');

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
