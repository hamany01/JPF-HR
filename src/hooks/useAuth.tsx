import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { UserProfile } from '../types/user';

export function normalizeRole(role: string): any {
  if (role === 'law_manager') return 'law_firm_manager';
  if (role === 'law_assistant') return 'law_firm_assistant';
  if (role === 'employee') return 'sales_employee';
  if (role === 'company_assistant') return 'assistant_manager';
  return role;
}

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
            const userData = { id: docSnap.id, uid: docSnap.id, ...docSnap.data() } as any;
            const originalRole = userData.role || '';
            const normalizedRole = normalizeRole(originalRole);
            
            const profileData: UserProfile = {
              ...userData,
              role: normalizedRole,
              originalRole: originalRole,
            };
            
            setProfile(profileData);
            
            // SECURITY FIX: Removed bootstrapAdminIfNeeded — auto-promoting any user to admin
            // when no admin exists is a critical privilege escalation vulnerability.
            // Admin accounts must be created manually via the admin console or a secure setup script.
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
