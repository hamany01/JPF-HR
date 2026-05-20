import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Loader2, Plus, Trash2, Save, Globe } from 'lucide-react';

export default function ExecutionPlatformsSettings() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [newPlatform, setNewPlatform] = useState('');

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const docRef = doc(db, 'settings', 'executionPlatforms');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setPlatforms(docSnap.data().options || []);
      } else {
        const defaults = ["ناجز", "تراضي", "عمالية مكتب العمل"];
        await setDoc(docRef, { options: defaults });
        setPlatforms(defaults);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleAddPlatform = () => {
    if (!newPlatform.trim()) return;
    if (platforms.includes(newPlatform.trim())) {
      alert('المنصة موجودة بالفعل');
      return;
    }
    setPlatforms([...platforms, newPlatform.trim()]);
    setNewPlatform('');
  };

  const handleRemovePlatform = (index: number) => {
    const updated = [...platforms];
    updated.splice(index, 1);
    setPlatforms(updated);
  };

  const handleUpdatePlatform = (index: number, value: string) => {
    const updated = [...platforms];
    updated[index] = value;
    setPlatforms(updated);
  };

  const saveSettings = async () => {
    setSubmitting(true);
    try {
      const docRef = doc(db, 'settings', 'executionPlatforms');
      await updateDoc(docRef, { options: platforms });
      alert('تم حفظ الإعدادات بنجاح');
    } catch (error: any) {
      alert(`خطأ في الحفظ: ${error.message}`);
    }
    setSubmitting(false);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 gap-4">
      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      <div className="text-slate-500 font-medium">جاري تحميل المنصات...</div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-slate-800">منصات التنفيذ</h2>
        <p className="text-sm text-slate-500">إدارة المنصات والخيارات المتاحة لاختيارها في نماذج القضايا</p>
      </div>

      <div className="bg-slate-50/50 border border-slate-100 rounded-[2rem] p-8 space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <Globe size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">القائمة الحالية</span>
          </div>
          
          <div className="grid gap-3">
            {platforms.map((platform, idx) => (
              <div key={idx} className="flex gap-2 group">
                <input 
                  type="text"
                  value={platform}
                  onChange={(e) => handleUpdatePlatform(idx, e.target.value)}
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700 shadow-sm"
                />
                <button 
                  onClick={() => handleRemovePlatform(idx)}
                  className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            ))}

            <div className="flex gap-2 pt-4">
              <input 
                type="text"
                placeholder="إضافة منصة جديدة..."
                value={newPlatform}
                onChange={(e) => setNewPlatform(e.target.value)}
                className="flex-1 bg-indigo-50/30 border border-indigo-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300"
              />
              <button 
                onClick={handleAddPlatform}
                className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-indigo-50">
          <button 
            onClick={saveSettings}
            disabled={submitting}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save size={20} />}
            حفظ إعدادات المنصات
          </button>
        </div>
      </div>
    </div>
  );
}
