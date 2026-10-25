'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup,
  getAdditionalUserInfo, 
  signOut as firebaseSignOut 
} from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { isUserAdmin } from '@/src/config/admin';
import { normalizeReferralCode } from '@/lib/referral-utils';
import { isValidCouponCode } from '@/lib/coupon';
import { SignInDialog } from '@/components/SignInDialog';
import { CustomerProfilePrompt } from '@/components/CustomerProfilePrompt';
import { validateCustomerProfile, type CustomerProfile } from '@/lib/customer-profile';
import { readApiResponse } from '@/lib/api-response';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  authError: string | null;
  customerProfile: CustomerProfile | null;
  editContactDetails: () => void;
  clearAuthError: () => void;
  signIn: () => Promise<User | null>;
  signInWithGoogle: () => Promise<User | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
  authError: null,
  customerProfile: null,
  editContactDetails: () => {},
  clearAuthError: () => {},
  signIn: async () => null,
  signInWithGoogle: async () => null,
  signOut: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showSignIn, setShowSignIn] = useState(false);
  const pendingSignIn = useRef<{ promise: Promise<User | null>; resolve: (user: User | null) => void } | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [signupContactUid, setSignupContactUid] = useState<string | null>(null);
  const [editingContactUid, setEditingContactUid] = useState<string | null>(null);
  const closeContactEditor = useCallback(() => setEditingContactUid(null), []);
  const editContactDetails = () => { if (user) setEditingContactUid(user.uid); };
  const [savedProfile, setSavedProfile] = useState<{ uid: string; profile: CustomerProfile } | null>(null);
  const saveProfile = useCallback((profile: CustomerProfile) => { if (user) { setSavedProfile({ uid: user.uid, profile }); setSignupContactUid(null); } }, [user]);
  const customerProfile = savedProfile?.uid === user?.uid ? savedProfile?.profile ?? null : null;

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        const result = await readApiResponse(await fetch('/api/customer-profile', {
          headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: 'no-store',
        }));
        if (active && result.profile) setSavedProfile({ uid: user.uid, profile: validateCustomerProfile(result.profile) });
      } catch { /* Profile loading must not open the signup dialog for existing accounts. */ }
    })();
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    const incoming = normalizeReferralCode(new URLSearchParams(window.location.search).get('coupon') || new URLSearchParams(window.location.search).get('ref'));
    try {
      if (isValidCouponCode(incoming)) localStorage.setItem('pendingAgentReferral', incoming);
    } catch { /* Referral links still work when browser storage is disabled. */ }
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      // Referral attribution must not hold every signed-in page in its loading state.
      setLoading(false);
      if (currentUser) {
        // Vendor admin is authorized when email matches designated admin email and is verified
        setIsAdmin(isUserAdmin(currentUser.email, currentUser.emailVerified));
        setAuthError(null);
        let agentCode = incoming;
        try { agentCode = localStorage.getItem('pendingAgentReferral') || incoming; } catch {}
        if (isValidCouponCode(agentCode)) {
          try {
            const token = await currentUser.getIdToken();
            const response = await fetch('/api/referrals/agent', {
              method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ code: agentCode }),
            });
            // The server identifies agents by their stored kind, not a prefix.
            // Other valid coupon links do not need an attribution retry.
            if (response.ok || response.status === 400 || response.status === 404 || response.status === 409) { try { if (localStorage.getItem('pendingAgentReferral') === agentCode) localStorage.removeItem('pendingAgentReferral'); } catch {} }
          } catch (error) { console.error('Agent referral tracking failed:', error); }
        }
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
      if (getAdditionalUserInfo(result)?.isNewUser) setSignupContactUid(result.user.uid);
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
        humanMessage = 'Sign-in is temporarily unavailable. Please try again later or contact support.';
      } else if (err?.code === 'auth/cancelled-popup-request') {
        humanMessage = 'A sign-in request is already in progress.';
      }

      setAuthError(humanMessage);
      throw new Error(humanMessage);
    }
  };

  const signIn = (): Promise<User | null> => {
    if (auth.currentUser) return Promise.resolve(auth.currentUser);
    if (pendingSignIn.current) return pendingSignIn.current.promise;
    setAuthError(null);
    let resolve!: (user: User | null) => void;
    const promise = new Promise<User | null>(done => { resolve = done; });
    pendingSignIn.current = { promise, resolve };
    setShowSignIn(true);
    return promise;
  };
  const finishSignIn = (signedInUser: User | null, newAccount = false) => {
    setShowSignIn(false);
    setAuthError(null);
    if (signedInUser && newAccount) setSignupContactUid(signedInUser.uid);
    pendingSignIn.current?.resolve(signedInUser);
    pendingSignIn.current = null;
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setEditingContactUid(null);
      setSignupContactUid(null);
      setSavedProfile(null);
      setIsAdmin(false);
      setAuthError(null);
    } catch (error) {
      console.error('Sign-Out failed:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, customerProfile, editContactDetails, authError, clearAuthError, signIn, signInWithGoogle, signOut }}>
      {children}
      {showSignIn && <SignInDialog onGoogle={signInWithGoogle} onComplete={finishSignIn} onCancel={() => finishSignIn(null)} />}
      {user && editingContactUid === user.uid && <CustomerProfilePrompt key={`edit-${user.uid}`} user={user} onSaved={saveProfile} onSignOut={signOut} onClose={closeContactEditor} />}
      {user && !showSignIn && signupContactUid === user.uid && !isAdmin && !customerProfile && editingContactUid !== user.uid && <CustomerProfilePrompt key={user.uid} user={user} onSaved={saveProfile} onSignOut={signOut} />}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
