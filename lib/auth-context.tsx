'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut as firebaseSignOut 
} from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { isUserAdmin } from '@/src/config/admin';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<User | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
  authError: null,
  clearAuthError: () => {},
  signInWithGoogle: async () => null,
  signOut: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Vendor admin is authorized when email matches designated admin email and is verified
        setIsAdmin(isUserAdmin(currentUser.email, currentUser.emailVerified));
        setAuthError(null);
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const clearAuthError = () => setAuthError(null);

  const signInWithGoogle = async (): Promise<User | null> => {
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (error: unknown) {
      console.error('Google Sign-In failed:', error);
      let humanMessage = 'Google Sign-In was not completed. Please try again.';

      const err = error as { code?: string; message?: string };
      if (err?.code === 'auth/popup-blocked') {
        humanMessage = 'The Google sign-in popup window was blocked by your browser or iframe. Please allow popups for this site or open in a new tab.';
      } else if (err?.code === 'auth/popup-closed-by-user') {
        humanMessage = 'The sign-in window was closed before completing authentication.';
      } else if (err?.code === 'auth/unauthorized-domain') {
        humanMessage = 'This domain is not in Firebase Authorized Domains. In Firebase Console, go to Authentication > Settings > Authorized domains and add this URL.';
      } else if (err?.code === 'auth/cancelled-popup-request') {
        humanMessage = 'A sign-in request is already in progress.';
      } else if (err?.message) {
        humanMessage = err.message;
      }

      setAuthError(humanMessage);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setIsAdmin(false);
      setAuthError(null);
    } catch (error) {
      console.error('Sign-Out failed:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, authError, clearAuthError, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
