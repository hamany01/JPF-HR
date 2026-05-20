import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Loader2, Plus, Trash2, Save, List } from 'lucide-react';

export default function GeneralExecutionSettings() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [settings, setSettings] = useState({
    transactionTypes: [] as string[],
    idTypes: [] as string[]
  });

  const [newTransactionType, setNewTransactionType] = useState('');
  const [newIdType, setNewIdType] = useState('');

  const fetchSettings = async () => {
    setLoading(true);
    try {
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

  const saveSettings = async () => {
    setSubmitting(true);
    try {
      const docRef = doc(db, 'settings', 'execution');
      await setDoc(docRef, settings, { merge: true });
      alert('تم حفظ الإعدادات بنجاح');
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
    <div className="space-y-12 animate-in fade-in duration-500">
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
          حفظ الإعدادات المتقدمة
        </button>
      </div>
    </div>
  );
}
