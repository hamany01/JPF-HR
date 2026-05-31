import React, { useState, useEffect } from 'react';
import { useNotes } from '../../hooks/useNotes';
import { useAuth } from '../../hooks/useAuth';
import { NoteCard } from './NoteCard';
import { AddNoteModal } from './AddNoteModal';
import { Note } from '../../types/note';
import { 
  Filter, 
  MessageSquare, 
  Plus, 
  Lock, 
  User, 
  Globe, 
  ChevronDown,
  Inbox
} from 'lucide-react';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { createRequestEvent } from '../../services/eventService';
import { toast } from 'react-hot-toast';

interface NotesSystemProps {
  requestId: string;
  requestSerialNumber?: string;
}

export const NotesSystem: React.FC<NotesSystemProps> = ({ requestId, requestSerialNumber }) => {
  const { notes, loading, addNote, deleteNote } = useNotes(requestId);
  const { profile } = useAuth();
  
  const [viewFilter, setViewFilter] = useState<'all' | 'internal' | 'employee_targeted' | 'employee_public'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [serialNumber, setSerialNumber] = useState(requestSerialNumber || '');

  const currentUserRole = profile?.role || 'employee';
  const isManagement = ['admin', 'law_manager', 'company_manager', 'company_assistant', 'law_assistant'].includes(currentUserRole);

  // جلب الرقم التسلسلي للطلب إذا لم يكن ممرراً
  useEffect(() => {
    const fetchRequestDetails = async () => {
      if (serialNumber) return;
      try {
        const dbInstance = getFirestore();
        const docRef = doc(dbInstance, 'requests', requestId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setSerialNumber(snap.data().serialNumber || '');
        }
      } catch (err) {
        console.error('Failed to preload request serialIn NotesSystem:', err);
      }
    };
    fetchRequestDetails();
  }, [requestId, serialNumber]);

  // تطبيق الفلترة البصرية على الملاحظات
  const getFilteredNotes = () => {
    return notes.filter((note) => {
      if (viewFilter === 'all') return true;
      return note.scope === viewFilter;
    });
  };

  const filteredNotes = getFilteredNotes();

  const handleCreateNote = async (noteData: {
    content: string;
    scope: 'internal' | 'employee_targeted' | 'employee_public';
    targetEmployeeId?: string;
    targetEmployeeName?: string;
  }) => {
    if (!profile) return;

    // إضافة الملاحظة لقاعدة البيانات
    await addNote({
      ...noteData,
      requestSerialNumber: serialNumber || requestId
    });

    // إرسال إشعار للنظام / تيليجرام
    try {
      let telegramChatId = '';
      if (noteData.scope === 'employee_targeted' && noteData.targetEmployeeId) {
        const userDocRef = doc(db, 'users', noteData.targetEmployeeId);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          telegramChatId = userSnap.data()?.telegramChatId || '';
        }
      }

      // تسجيل الحدث لإنتاج التنبيهات الفورية
      let eventType: 'request_created' | 'request_reactivated' = 'request_reactivated';
      let messageSuffix = '';
      if (noteData.scope === 'internal') {
        messageSuffix = ' (ملاحظة داخلية)';
      } else if (noteData.scope === 'employee_targeted') {
        messageSuffix = ` (موجهة إلى ${noteData.targetEmployeeName})`;
      } else {
        messageSuffix = ' (ملاحظة عامة للموظفين)';
      }

      await createRequestEvent({
        requestId: requestId,
        requestSerialNumber: serialNumber || requestId,
        type: 'request_reactivated', // نستخدم تفعيل الطلب كـ eventType مدمج
        message: `تم إضافة ملاحظة جديدة من ${profile.name}${messageSuffix}: ${noteData.content.substring(0, 50)}...`,
        createdBy: profile.uid,
        createdByName: profile.name,
        payload: {
          noteScope: noteData.scope,
          targetEmployeeId: noteData.targetEmployeeId || null,
          customRecipients: telegramChatId ? [telegramChatId] : []
        }
      });
    } catch (err) {
      console.warn('Silent event log warning:', err);
    }
  };

  return (
    <div id="notes-system-wrapper" className="bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-850 p-6 shadow-sm">
      
      {/* ترويسة الحاويات */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.0 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>الملاحظات وتوجيهات العمل المتقدمة</span>
              <span className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full font-mono">
                {notes.length}
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              المستند اللحظي لملاحظات معالجة الطلبات وسرية الترافق الإداري
            </p>
          </div>
        </div>

        {/* زر الإضافة */}
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all duration-200 flex items-center gap-1.5 shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة ملاحظة</span>
        </button>
      </div>

      {/* شريط أدوات التصفية والفرز اللحظي (للإدارة فقط) */}
      {isManagement && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 bg-slate-50/50 dark:bg-slate-900/30 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <Filter className="w-4 h-4 text-slate-400" />
            <span>عرض:</span>
          </div>
          
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'all', label: 'الكل', count: notes.length, color: 'text-slate-700 bg-slate-100 hover:bg-slate-200' },
              { id: 'internal', label: '🔒 داخلية', count: notes.filter(n => n.scope === 'internal').length, color: 'text-rose-700 bg-rose-50 dark:bg-rose-950/20' },
              { id: 'employee_targeted', label: '👤 موجهة للموظفين', count: notes.filter(n => n.scope === 'employee_targeted').length, color: 'text-sky-700 bg-sky-50 dark:bg-sky-950/20' },
              { id: 'employee_public', label: '🌐 عامة', count: notes.filter(n => n.scope === 'employee_public').length, color: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setViewFilter(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer border ${
                  viewFilter === tab.id
                    ? 'bg-indigo-600 text-white border-indigo-600 dark:border-indigo-500 shadow-sm'
                    : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-mono ${
                  viewFilter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* قائمة وعروض الملاحظات اللحظية */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2">
          <span className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></span>
          <p className="text-xs text-slate-400">جاري تحميل وسجلات الملاحظات...</p>
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="py-12 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center text-center p-6">
          <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-full text-slate-400 dark:text-slate-500 mb-3">
            <Inbox className="w-6 h-6" />
          </div>
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            لا توجد ملاحظات مسجلة حالياً
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-sm mt-1">
            {viewFilter !== 'all' 
              ? 'جرّب تعديل خيار التصفية لعرض بنود ومراتب خصوصية متعددة.'
              : 'يمكنك البدء بإضافة التوجيه المهني الأول بالضغط على زر إضافة ملاحظة.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredNotes.map((note) => (
            <NoteCard 
              key={note.id} 
              note={note} 
              onDelete={deleteNote} 
            />
          ))}
        </div>
      )}

      {/* المودال لإنشاء الملاحظة الجديدة */}
      <AddNoteModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleCreateNote}
      />
    </div>
  );
};
export default NotesSystem;
