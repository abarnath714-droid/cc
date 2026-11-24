import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import type { User, UserRole } from '../types.ts';

interface PendingGoogleProfile {
  email: string;
  name: string;
  idToken: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  pendingGoogleProfile: PendingGoogleProfile | null;
  clearPendingGoogleProfile: () => void;
  loginWithPassword: (email: string, password: string) => Promise<User>;
  registerWithPassword: (payload: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    organizationName: string;
    phone?: string;
    address?: string;
    adminPasscode?: string;
  }) => Promise<User>;
  claimAdminAccount: (payload: {
    name: string;
    email: string;
    password: string;
    passcode?: string;
  }) => Promise<User>;
  signInWithGoogle: (profile?: {
    role?: 'donor' | 'ngo';
    organizationName?: string;
    phone?: string;
    address?: string;
  }) => Promise<{ user?: User; needsProfile?: boolean }>;
  completeGoogleProfile: (payload: {
    role: 'donor' | 'ngo';
    organizationName: string;
    phone?: string;
    address?: string;
  }) => Promise<User>;
  logout: () => Promise<void>;
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingGoogleProfile, setPendingGoogleProfile] = useState<PendingGoogleProfile | null>(
    null
  );
  // Keep bearer token strictly in React memory (never localStorage or sessionStorage)
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser && !tokenRef.current) {
        try {
          const idToken = await fbUser.getIdToken();
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${idToken}` },
          });
          if (res.ok) {
            const data = await res.json();
            tokenRef.current = idToken;
            setUser(data.user);
          }
        } catch {
          // Wait for explicit sign-in if user hasn't completed role selection
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const authFetch = useCallback(async (input: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers || {});
    if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    if (auth.currentUser && (!tokenRef.current || !tokenRef.current.startsWith('fsess.'))) {
      try {
        tokenRef.current = await auth.currentUser.getIdToken();
      } catch {
        // Ignore refresh error
      }
    }

    if (tokenRef.current) {
      headers.set('Authorization', `Bearer ${tokenRef.current}`);
    }

    return fetch(input, { ...init, headers });
  }, []);

  const loginWithPassword = useCallback(async (email: string, password: string): Promise<User> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Invalid email or password.');
    }
    tokenRef.current = data.token;
    setUser(data.user);
    setPendingGoogleProfile(null);
    return data.user as User;
  }, []);

  const registerWithPassword = useCallback(
    async (payload: {
      name: string;
      email: string;
      password: string;
      role: UserRole;
      organizationName: string;
      phone?: string;
      address?: string;
      adminPasscode?: string;
    }): Promise<User> => {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed.');
      }
      tokenRef.current = data.token;
      setUser(data.user);
      setPendingGoogleProfile(null);
      return data.user as User;
    },
    []
  );

  const claimAdminAccount = useCallback(
    async (payload: {
      name: string;
      email: string;
      password: string;
      passcode?: string;
    }): Promise<User> => {
      const res = await fetch('/api/auth/claim-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to set up administrator account.');
      }
      tokenRef.current = data.token;
      setUser(data.user);
      return data.user as User;
    },
    []
  );

  const signInWithGoogle = useCallback(
    async (profile?: {
      role?: 'donor' | 'ngo';
      organizationName?: string;
      phone?: string;
      address?: string;
    }): Promise<{ user?: User; needsProfile?: boolean }> => {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await cred.user.getIdToken();

      const res = await fetch('/api/auth/google-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(profile || {}),
      });
      const data = await res.json();

      if (res.status === 409 && data.needsProfile) {
        setPendingGoogleProfile({
          email: data.email || cred.user.email || '',
          name: data.name || cred.user.displayName || '',
          idToken,
        });
        return { needsProfile: true };
      }

      if (!res.ok) {
        throw new Error(data.error || 'Google sign-in failed.');
      }

      tokenRef.current = idToken;
      setUser(data.user);
      setPendingGoogleProfile(null);
      return { user: data.user as User };
    },
    []
  );

  const completeGoogleProfile = useCallback(
    async (payload: {
      role: 'donor' | 'ngo';
      organizationName: string;
      phone?: string;
      address?: string;
    }): Promise<User> => {
      if (!pendingGoogleProfile) {
        throw new Error('No pending Google sign-in session found.');
      }
      const res = await fetch('/api/auth/google-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pendingGoogleProfile.idToken}`,
        },
        body: JSON.stringify({
          ...payload,
          name: pendingGoogleProfile.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to finish creating your profile.');
      }
      tokenRef.current = pendingGoogleProfile.idToken;
      setUser(data.user);
      setPendingGoogleProfile(null);
      return data.user as User;
    },
    [pendingGoogleProfile]
  );

  const logout = useCallback(async () => {
    tokenRef.current = null;
    setUser(null);
    setPendingGoogleProfile(null);
    try {
      await firebaseSignOut(auth);
    } catch {
      // Ignore if not Firebase signed in
    }
  }, []);

  const clearPendingGoogleProfile = useCallback(() => {
    setPendingGoogleProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        pendingGoogleProfile,
        clearPendingGoogleProfile,
        loginWithPassword,
        registerWithPassword,
        claimAdminAccount,
        signInWithGoogle,
        completeGoogleProfile,
        logout,
        authFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
