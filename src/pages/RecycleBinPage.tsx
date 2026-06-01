import { Trash2 } from 'lucide-react';

export default function RecycleBinPage() {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center" dir="rtl">
      <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mb-6">
        <Trash2 className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-slate-800 mb-2">سلة المحذوفات</h2>
      <p className="text-slate-500 max-w-sm font-sans text-sm">
        سيتم إدراج القضايا المحذوفة مؤقتاً هنا في المراحل القادمة لتسهيل الاسترجاع والتفتيش من قبل الإدارة.
      </p>
    </div>
  );
}
