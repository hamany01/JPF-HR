import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { UserProfile } from '../types/user';

export interface EmployeeWithActiveCount extends UserProfile {
  activeRequestsCount: number;
}

export function useEmployees() {
  const [employees, setEmployees] = useState<EmployeeWithActiveCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    
    // 1. الاستعلام عن كل المستخدمين النشطين
    const usersRef = collection(db, 'users');
    const usersQuery = query(usersRef, where('isActive', '==', true));
    
    // 2. الاستعلام عن كل الطلبات النشطة لحساب أعداد التكليفات
    const requestsRef = collection(db, 'requests');
    const requestsQuery = query(requestsRef, where('status', 'in', ['pending', 'approved_preliminary']));

    let usersList: UserProfile[] = [];
    let requestsList: any[] = [];

    const updateCombinedState = () => {
      const combined = usersList.map((user) => {
        const count = requestsList.filter((req) => req.assignedEmployeeId === user.uid).length;
        return {
          ...user,
          activeRequestsCount: count,
        };
      }) as EmployeeWithActiveCount[];
      
      // ترتيب الموظفين حسب العبء الأقل لتسهيل التكليف المتوازن
      const sorted = combined.sort((a, b) => a.activeRequestsCount - b.activeRequestsCount);
      setEmployees(sorted);
    };

    const unsubscribeUsers = onSnapshot(
      usersQuery,
      (snapshot) => {
        usersList = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            uid: data.uid || doc.id,
            ...data,
          };
        }) as UserProfile[];
        updateCombinedState();
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching users in useEmployees:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    const unsubscribeRequests = onSnapshot(
      requestsQuery,
      (snapshot) => {
        requestsList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        updateCombinedState();
      },
      (err) => {
        console.warn('Could not subscribe directly to requests counts, relying on fallback zero:', err);
      }
    );

    return () => {
      unsubscribeUsers();
      unsubscribeRequests();
    };
  }, []);

  return { employees, loading, error };
}
