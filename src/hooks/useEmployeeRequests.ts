import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './useAuth';

export function useEmployeeRequests() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.uid) {
      setRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // بناء الاستعلام: جلب الطلبات المسندة للموظف الحالي
    const requestsRef = collection(db, 'requests');
    const q = query(
      requestsRef,
      where('assignedEmployeeId', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setRequests(fetched);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching employee requests:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [profile?.uid]);

  return { requests, loading, error };
}
