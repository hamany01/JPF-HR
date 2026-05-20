import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { UserProfile } from '../types/user';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * منطق تعيين أول أدمن تلقائياً:
   * يتحقق مما إذا كان المعرف الحالي يفتقر لصلاحية admin، 
   * فإذا لم يجد أي مسؤول آخر في النظام، يقوم بترقية المستخدم الحالي.
   */
  const bootstrapAdminIfNeeded = async (uid: string, currentProfile: any) => {
    if (currentProfile?.role === 'admin') return;

    try {
      // البحث عن أي مستخدم يملك دور admin
      const adminQuery = query(
        collection(db, 'users'), 
        where('role', '==', 'admin'), 
        limit(1)
      );
      const adminSnapshot = await getDocs(adminQuery);

      // إذا لم يوجد أي أدمن في النظام، قم بترقية المستخدم الحالي
      if (adminSnapshot.empty) {
        console.log("No admin found in system. Promoting current user to admin...");
        const userRef = doc(db, 'users', uid);
        const updateData = {
          role: 'admin',
          isActive: true,
          updatedAt: serverTimestamp(),
        };
        await updateDoc(userRef, updateData);
      }
    } catch (error) {
      console.error("Error in admin bootstrap:", error);
    }
  };

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (authenticatedUser) => {
      setUser(authenticatedUser);
      
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (authenticatedUser) {
        // Listen to profile changes in real-time
        unsubscribeProfile = onSnapshot(doc(db, 'users', authenticatedUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            const userData = { id: docSnap.id, uid: docSnap.id, ...docSnap.data() } as UserProfile;
            setProfile(userData);
            
            // Bootstrap admin if this is the first user (only if not already admin)
            if (userData.role !== 'admin') {
              bootstrapAdminIfNeeded(authenticatedUser.uid, userData);
            }
          } else {
            setProfile(null);
          }
          setLoading(false);
        }, (error) => {
          console.error("Error loading profile snapshot:", error);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const value = {
    user,
    profile,
    loading,
    isAdmin: profile?.role === 'admin',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
