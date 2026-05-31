import React, { useState } from 'react';
import { Note } from '../../types/note';
import { useAuth } from '../../hooks/useAuth';
import { Lock, User, Globe, Trash2, Calendar, ShieldCheck, UserCheck, Users } from 'lucide-react';
import { doc, getFirestore, updateDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-hot-toast';

interface NoteCardProps {
  note: Note;
  onDelete: (noteId: string) => Promise<void>;
}

export const NoteCard: React.FC<NoteCardProps> = ({ note, onDelete }) => {
  const { profile } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(note.content);
  const [isSaving, setIsSaving] = useState(false);

  // التحقق من صلاحية الحذف أو التعديل (المدير العام أو كاتب الملاحظة)
  const canModify = profile?.role === 'admin' || profile?.uid === note.createdBy;

  // تحديد المظهر بناءً على نوع الصلاحية والوصول
  const getScopeDetails = () => {
    switch (note.scope) {
      case 'internal':
        return {
          icon: <Lock className="w-4 h-4 text-rose-500" />,
          label: 'ملاحظة داخلية للادارة',
          badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300',
          cardClass: 'border-rose-200 bg-rose-50/50 dark:bg-rose-950/15 dark:border-rose-900/40',
        };
      case 'employee_targeted':
        return {
          icon: <User className="w-4 h-4 text-sky-500" />,
          label: `موجهة → ${note.targetEmployeeName || 'الموظف المسئول'}`,
          badgeClass: 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300',
          cardClass: 'border-sky-200 bg-sky-50/50 dark:bg-sky-950/15 dark:border-sky-900/40',
        };
      case 'employee_public':
      default:
        return {
          icon: <Globe className="w-4 h-4 text-emerald-500" />,
          label: 'ملاحظة عامة للموظفين',
          badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
          cardClass: 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/15 dark:border-emerald-900/40',
        };
    }
  };

  const details = getScopeDetails();

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'text-rose-600 bg-rose-50 border-rose-100 dark:bg-rose-950/30';
      case 'law_manager':
        return 'text-amber-600 bg-amber-50 border-amber-100 dark:bg-amber-950/30';
      case 'company_manager':
        return 'text-indigo-600 bg-indigo-50 border-indigo-100 dark:bg-indigo-950/30';
      default:
        return 'text-slate-600 bg-slate-50 border-slate-100 dark:bg-slate-900/30';
    }
  };

  const getRoleLabelAr = (role: string) => {
    switch (role) {
      case 'admin': return 'المدير العام';
      case 'law_manager': return 'المحامي العام';
      case 'law_assistant': return 'مساعد قانوني';
      case 'company_manager': return 'مدير الشركة';
      case 'company_assistant': return 'مساعد إدارة';
      case 'employee': return 'موظف';
      default: return 'مستخدم';
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف هذه الملاحظة نهائياً؟')) return;
    setIsDeleting(true);
    try {
      await onDelete(note.id);
      toast.success('تم حذف الملاحظة بنجاح');
    } catch (err: any) {
      toast.error('فشل في حذف الملاحظة: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditSave = async () => {
    if (!editContent.trim()) {
      toast.error('لا يمكن ترك نص الملاحظة فارغاً');
      return;
    }
    setIsSaving(true);
    try {
      const db = getFirestore();
      const noteRef = doc(db, `requests/${note.requestId}/notes`, note.id);
      await updateDoc(noteRef, {
        content: editContent,
        updatedAt: serverTimestamp(),
      });
      toast.success('تم تعديل الملاحظة بنجاح');
      setIsEditing(false);
    } catch (err: any) {
      toast.error('فشل في حفظ التعديلات: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // تنسيق التاريخ باللغة العربية
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'قيد الرفع...';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('ar-EG', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  return (
    <div 
      id={`note-card-${note.id}`}
      className={`border rounded-xl p-4 transition-all duration-300 shadow-sm hover:shadow-md ${details.cardClass} relative group overflow-hidden`}
    >
      {/* رأس البطاقة */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${details.badgeClass}`}>
            {details.icon}
            {details.label}
          </span>
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${getRoleBadgeColor(note.creatorRole)}`}>
            {note.creatorName} ({getRoleLabelAr(note.creatorRole)})
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
          <Calendar className="w-3.5 h-3.5" />
          <span>{formatDate(note.createdAt)}</span>
        </div>
      </div>

      {/* نص الملاحظة */}
      <div className="text-slate-800 dark:text-slate-100 leading-relaxed text-sm whitespace-pre-line select-text">
        {isEditing ? (
          <div className="space-y-2 mt-2">
            <textarea
              className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-sm"
              rows={3}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="اكتب ملاحظتك..."
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setEditContent(note.content);
                  setIsEditing(false);
                }}
                disabled={isSaving}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                إلغاء
              </button>
              <button
                onClick={handleEditSave}
                disabled={isSaving}
                className="px-3 py-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-lg shadow-sm"
              >
                {isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </button>
            </div>
          </div>
        ) : (
          <p className="py-1">{note.content}</p>
        )}
      </div>

      {/* خيارات المرفقات المدمجة إن وجدت */}
      {note.attachments && note.attachments.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800/60 flex flex-wrap gap-2">
          {note.attachments.map((file, idx) => (
            <a
              key={idx}
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 rounded hover:underline border border-indigo-100 dark:border-indigo-900/30"
            >
              📎 {file.name}
            </a>
          ))}
        </div>
      )}

      {/* أزرار الإجراءات في الطرف السفلي */}
      {canModify && !isEditing && (
        <div className="mt-3 pt-3 border-t border-dashed border-slate-200 dark:border-slate-800/60 flex justify-end gap-3 opacity-80 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setIsEditing(true)}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
          >
            تعديل
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-xs text-rose-600 dark:text-rose-400 hover:underline cursor-pointer flex items-center gap-1 hover:text-rose-700"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>حذف</span>
          </button>
        </div>
      )}
    </div>
  );
};
