import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Loader2, Plus, Trash2, Save, UserCheck } from 'lucide-react';

export default function RequestorsSettings() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requestors, setRequestors] = useState<{ id: string, name: string }[]>([]);
  const [newRequestor, setNewRequestor] = useState('');

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const docRef = doc(db, 'settings', 'execution');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setRequestors(docSnap.data().requestors || []);
      } else {
        const defaults = [{ id: 'client1', name: 'شركة سنا للتطوير للمقاولات' }];
        await setDoc(docRef, { requestors: defaults });
        setRequestors(defaults);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleAddRequestor = () => {
    if (!newRequestor.trim()) return;
    if (requestors.find(r => r.name === newRequestor.trim())) {
      alert('مقدم الطلب موجود بالفعل');
      return;
    }
    const id = Date.now().toString();
    setRequestors([...requestors, { id, name: newRequestor.trim() }]);
    setNewRequestor('');
  };

  const handleRemoveRequestor = (id: string) => {
    setRequestors(requestors.filter(r => r.id !== id));
  };

  const saveSettings = async () => {
    setSubmitting(true);
    try {
      const docRef = doc(db, 'settings', 'execution');
      await updateDoc(docRef, { requestors: requestors });
      alert('تم حفظ الإعدادات بنجاح');
    } catch (error: any) {
      // If doc doesn't exist, set it
      try {
        const docRef = doc(db, 'settings', 'execution');
        await setDoc(docRef, { requestors: requestors }, { merge: true });
        alert('تم حفظ الإعدادات بنجاح');
      } catch (innerError: any) {
        alert(`خطأ في الحفظ: ${innerError.message}`);
      }
    }
    setSubmitting(false);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 gap-4">
      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      <div className="text-slate-500 font-medium">جاري تحميل مقدمي الطلبات...</div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-slate-800">مقدمو الطلبات</h2>
        <p className="text-sm text-slate-500">إدارة القائمة التي يختار منها الموظفون مقدم الطلب في نموذج الطلبات</p>
      </div>

      <div className="bg-slate-50/50 border border-slate-100 rounded-[2rem] p-8 space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <UserCheck size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">القائمة الحالية</span>
          </div>
          
          <div className="grid gap-3">
            {requestors.map((requestor) => (
              <div key={requestor.id} className="flex gap-2 group">
                <input 
                  type="text"
                  value={requestor.name}
                  readOnly
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700 shadow-sm"
                />
                <button 
                  onClick={() => handleRemoveRequestor(requestor.id)}
                  className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            ))}

            <div className="flex gap-2 pt-4">
              <input 
                type="text"
                placeholder="إضافة مقدم طلب جديد..."
                value={newRequestor}
                onChange={(e) => setNewRequestor(e.target.value)}
                className="flex-1 bg-indigo-50/30 border border-indigo-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300"
              />
              <button 
                onClick={handleAddRequestor}
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
            حفظ إعدادات مقدمي الطلبات
          </button>
        </div>
      </div>
    </div>
  );
}
