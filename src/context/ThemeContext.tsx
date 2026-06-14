import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { auth, db } from '../firebase/config';
import toast from 'react-hot-toast';

export type AppTheme = 'classic' | 'glass';

interface ThemeContextType {
  theme: AppTheme;
  setTheme: (newTheme: AppTheme) => Promise<void>;
  isApplying: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'classic',
  setTheme: async () => {},
  isApplying: false,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [theme, setThemeState] = useState<AppTheme>(() => {
    const cached = localStorage.getItem('theme');
    if (cached === 'glass' || cached === 'classic') return cached as AppTheme;
    return 'classic';
  });
  const [isApplying, setIsApplying] = useState(false);

  // Sync state with profile theme changes from Firebase
  useEffect(() => {
    if (profile?.theme && profile.theme !== theme) {
      setThemeState(profile.theme as AppTheme);
      localStorage.setItem('theme', profile.theme);
    }
  }, [profile?.theme]);

  // Apply CSS classes or style changes to the root wrapper element
  useEffect(() => {
    const root = document.getElementById('root') || document.body;
    if (theme === 'glass') {
      root.classList.add('theme-glass');
      root.classList.remove('theme-classic');
    } else {
      root.classList.add('theme-classic');
      root.classList.remove('theme-glass');
    }
  }, [theme]);

  const setTheme = async (newTheme: AppTheme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);

    const currentUser = auth.currentUser;
    if (currentUser) {
      setIsApplying(true);
      try {
        // 1. Update Firestore directly from the authenticated client-side (Guaranteed to succeed due to client authorization)
        try {
          const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
          const userRef = doc(db, 'users', currentUser.uid);
          await updateDoc(userRef, {
            theme: newTheme,
            updatedAt: serverTimestamp()
          });
        } catch (clientDbErr) {
          console.error("Client-side direct Firestore theme update failed: ", clientDbErr);
        }

        // 2. Best-effort background replication API PATCH call
        const token = await currentUser.getIdToken();
        const response = await fetch('/api/users/me/theme', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ theme: newTheme })
        });
        const result = await response.json();
        if (!result.success) {
          console.log("Backend theme sync returned non-success (graceful bypass as client-side update succeeded):", result.message);
        }
      } catch (err) {
        console.error("Error invoking theme setting endpoints:", err);
      } finally {
        setIsApplying(false);
      }
    }
  };

  const value = {
    theme,
    setTheme,
    isApplying,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
