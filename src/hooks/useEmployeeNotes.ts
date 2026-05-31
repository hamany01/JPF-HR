import { useState, useEffect } from 'react';
import { collectionGroup, query, where, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './useAuth';

export function useEmployeeNotes() {
  const { profile } = useAuth();
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.uid) {
      setNotes([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // محاولة استخدام الاستعلام المباشر عبر collectionGroup
      const notesRef = collectionGroup(db, 'notes');
      const q = query(
        notesRef,
        where('createdBy', '==', profile.uid),
        orderBy('createdAt', 'desc'),
        limit(5)
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const fetched = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setNotes(fetched);
          setError(null);
          setLoading(false);
        },
        async (err) => {
          console.warn('Index error or permission warn for collectionGroup notes, trying fallback client-side sort:', err);
          
          // في حال لم يتم تفعيل الفهرس المركب (Composite Index) بعد، 
          // نقوم بطلب جلب الملاحظات المسندة للمستخدم بدون فرز مسبق، ومن ثم فرزها بالمتصفح لتجنب تعطل الواجهة.
          try {
            const fallbackQuery = query(
              notesRef,
              where('createdBy', '==', profile.uid)
            );
            
            const snapshot = await getDocs(fallbackQuery);
            const fetched = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));

            // فرز محلي للتمرير السلس
            const sorted = fetched
              .sort((a: any, b: any) => {
                const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime();
                const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime();
                return bTime - aTime;
              })
              .slice(0, 5);

            setNotes(sorted);
            setError(null);
            setLoading(false);
          } catch (fallbackErr: any) {
            console.error('Notes fallback query also failed:', fallbackErr);
            setError(fallbackErr.message);
            setLoading(false);
          }
        }
      );

      return () => unsubscribe();
    } catch (err: any) {
      console.error('Failed to initialize notes listener:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [profile?.uid]);

  return { notes, loading, error };
}
