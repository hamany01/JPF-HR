import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Loader2, Plus, Trash2, Save, Activity as ActivityIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface StatusOption {
  value: string;
  label: string;
  color: string;
}

export default function ExecutionStatusSettings() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statuses, setStatuses] = useState<StatusOption[]>([]);
  const [newStatus, setNewStatus] = useState({ value: '', label: '', color: 'blue' });

  const colorOptions = [
    { name: 'أزرق', value: 'blue' },
    { name: 'أخضر', value: 'green' },
    { name: 'أحمر', value: 'red' },
    { name: 'رمادي', value: 'gray' },
    { name: 'برتقالي', value: 'orange' },
    { name: 'بنفسجي', value: 'purple' },
  ];

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const docRef = doc(db, 'settings', 'executionStatuses');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setStatuses(docSnap.data().options || []);
      } else {
        const defaults = [
          { value: "open", label: "مفتوحة", color: "green" },
          { value: "in_progress", label: "قيد التنفيذ", color: "blue" },
          { value: "closed", label: "منتهية", color: "gray" }
        ];
        await setDoc(docRef, { options: defaults });
        setStatuses(defaults);
      }
    } catch (error) {
      console.error("Error fetching statuses:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleAddStatus = () => {
    if (!newStatus.value || !newStatus.label) return;
    if (statuses.find(s => s.value === newStatus.value)) {
      alert('قيمة الحالة (Value) موجودة مسبقاً');
      return;
    }
    setStatuses([...statuses, { ...newStatus }]);
    setNewStatus({ value: '', label: '', color: 'blue' });
  };

  const handleRemoveStatus = (index: number) => {
    const updated = [...statuses];
    updated.splice(index, 1);
    setStatuses(updated);
  };

  const saveSettings = async () => {
    setSubmitting(true);
    try {
      const docRef = doc(db, 'settings', 'executionStatuses');
      await updateDoc(docRef, { options: statuses });
      alert('تم حفظ حالات التنفيذ بنجاح');
    } catch (error: any) {
      alert(`خطأ في الحفظ: ${error.message}`);
    }
    setSubmitting(false);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 gap-4">
      <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      <p className="text-slate-500 font-medium">جاري تحميل إعدادات الحالات...</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-slate-800">حالات القضايا</h2>
        <p className="text-sm text-slate-500">تخصيص الحالات، الألوان، والمسميات التي تظهر في النظام</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="bg-slate-50/50 border border-slate-100 rounded-[2rem] p-8 space-y-6">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Plus size={16} />
            إضافة حالة جديدة
          </h3>
          
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">المسمى العربي (Label)</label>
              <input 
                type="text"
                value={newStatus.label}
                onChange={(e) => setNewStatus({...newStatus, label: e.target.value})}
                placeholder="مثال: تحت الدراسة"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 shadow-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">القيمة التقنية (Value)</label>
              <input 
                type="text"
                value={newStatus.value}
                onChange={(e) => setNewStatus({...newStatus, value: e.target.value})}
                placeholder="مثال: under_study"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-mono text-sm shadow-sm"
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">لون الشارة</label>
              <div className="grid grid-cols-3 gap-2">
                {colorOptions.map(color => (
                  <button
                    key={color.value}
                    onClick={() => setNewStatus({...newStatus, color: color.value})}
                    className={cn(
                      "px-3 py-2 rounded-lg text-[10px] font-bold border transition-all",
                      newStatus.color === color.value 
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-500 border-slate-200 hover:bg-slate-100"
                    )}
                  >
                    {color.name}
                  </button>
                ))}
              </div>
            </div>
            <button 
              onClick={handleAddStatus}
              className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-50"
            >
              <Plus size={18} />
              إضافة للقائمة المبدئية
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-2">
            <ActivityIcon size={16} />
            قائمة الحالات الحالية
          </h3>
          <div className="grid gap-3">
            {statuses.map((status, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm group transition-all hover:border-indigo-100">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-3 h-3 rounded-full shadow-sm",
                    status.color === 'blue' && 'bg-blue-500',
                    status.color === 'green' && 'bg-green-500',
                    status.color === 'red' && 'bg-red-500',
                    status.color === 'gray' && 'bg-slate-400',
                    status.color === 'orange' && 'bg-orange-500',
                    status.color === 'purple' && 'bg-purple-500',
                  )} />
                  <div>
                    <div className="font-bold text-slate-800">{status.label}</div>
                    <div className="text-[10px] font-mono text-slate-400 uppercase">{status.value}</div>
                  </div>
                </div>
                <button 
                  onClick={() => handleRemoveStatus(idx)}
                  className="p-2 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="pt-8 border-t border-slate-100">
        <button 
          onClick={saveSettings}
          disabled={submitting}
          className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] font-black shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-3"
        >
          {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save size={20} />}
          حفظ وتفعيل الحالات في النظام
        </button>
      </div>
    </div>
  );
}
