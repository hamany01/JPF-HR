import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Note } from '../types/note';
import { useAuth } from './useAuth';

export const useNotes = (requestId: string) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useAuth();

  useEffect(() => {
    if (!requestId || !profile) {
      setNotes([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const notesRef = collection(db, `requests/${requestId}/notes`);
    const q = query(notesRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedNotes = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Note[];

        // تصفية أمنية على مستوى الـ Hook لضمان عدم تسريب البيانات
        const filteredNotes = fetchedNotes.filter((note) => {
          const currentUserRole = profile.role || 'employee';

          // 1. الإدارة والمسؤولون والشركاء يرون كافة المستجدات
          if (['admin', 'law_manager', 'company_manager', 'company_assistant', 'law_assistant'].includes(currentUserRole)) {
            return true;
          }

          // 2. الموظف العادي برتبة محدودة يرى فقط ما يلي
          if (currentUserRole === 'employee') {
            // أ. ملاحظات عامة لكافة الموظفين الموجهة
            if (note.scope === 'employee_public') {
              return true;
            }

            // ب. ملاحظة موجهة له بالاسم خصيصاً
            if (note.scope === 'employee_targeted' && note.targetEmployeeId === profile.uid) {
              return true;
            }

            // ج. الملاحظات التي قام بصياغتها ورفعها هو شخصياً
            if (note.createdBy === profile.uid) {
              return true;
            }

            return false;
          }

          return false;
        });

        setNotes(filteredNotes);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Error listening to notes:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [requestId, profile]);

  // إضافة ملاحظة جديدة آمنة
  const addNote = async (noteData: Partial<Note>) => {
    if (!profile || !requestId) {
      throw new Error('User conversation context session is not authenticated.');
    }

    const notesRef = collection(db, `requests/${requestId}/notes`);

    // بناء قائمة المستفيدين / الصلاحيات المرئية للـ Note
    const visibleTo: string[] = ['admin', 'law_manager', 'company_manager'];
    if (noteData.scope === 'employee_public') {
      visibleTo.push('employee', 'law_assistant', 'company_assistant');
    } else if (noteData.scope === 'employee_targeted' && noteData.targetEmployeeId) {
      visibleTo.push(noteData.targetEmployeeId);
    }

    const payload = {
      content: noteData.content,
      createdBy: profile.uid,
      creatorName: profile.name,
      creatorRole: profile.role || 'employee',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      scope: noteData.scope || 'employee_public',
      targetEmployeeId: noteData.targetEmployeeId || null,
      targetEmployeeName: noteData.targetEmployeeName || null,
      visibleTo: visibleTo,
      attachments: noteData.attachments || [],
      requestId: requestId,
      requestSerialNumber: noteData.requestSerialNumber || requestId
    };

    await addDoc(notesRef, payload);
  };

  // حذف الملاحظة
  const deleteNote = async (noteId: string) => {
    if (!requestId) return;
    const noteDocRef = doc(db, `requests/${requestId}/notes`, noteId);
    await deleteDoc(noteDocRef);
  };

  return { notes, loading, error, addNote, deleteNote };
};
export default useNotes;
