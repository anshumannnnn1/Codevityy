import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, ensureUserProfileDoc, updateUserProfileDoc } from '../lib/firebase';
import type { UserProfile } from '../types/codevity';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateDisplayName: (newName: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const p = await ensureUserProfileDoc({
            uid: firebaseUser.uid,
            name:
              firebaseUser.displayName ||
              firebaseUser.email?.split('@')[0] ||
              'Developer',
            email: firebaseUser.email || '',
          });
          setProfile(p);
        } catch (err) {
          console.error('Failed to load user profile:', err);
          setProfile({
            userId: firebaseUser.uid,
            name: firebaseUser.displayName || 'Developer',
            email: firebaseUser.email || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const signUpWithEmail = async (name: string, email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(cred.user, { displayName: name.trim() });
    try {
      await sendEmailVerification(cred.user);
    } catch {
      // Verification email dispatch is best-effort
    }
    const p = await ensureUserProfileDoc({
      uid: cred.user.uid,
      name: name.trim(),
      email: email.trim(),
    });
    setProfile(p);
  };

  const signInWithEmail = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    const p = await ensureUserProfileDoc({
      uid: cred.user.uid,
      name: cred.user.displayName || email.split('@')[0] || 'Developer',
      email: cred.user.email || email.trim(),
    });
    setProfile(p);
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    const p = await ensureUserProfileDoc({
      uid: cred.user.uid,
      name: cred.user.displayName || cred.user.email?.split('@')[0] || 'Developer',
      email: cred.user.email || '',
    });
    setProfile(p);
  };

  const logout = async () => {
    await signOut(auth);
    setProfile(null);
  };

  const updateDisplayName = async (newName: string) => {
    if (!auth.currentUser) return;
    const trimmed = newName.trim();
    await updateProfile(auth.currentUser, { displayName: trimmed });
    await updateUserProfileDoc({
      uid: auth.currentUser.uid,
      name: trimmed,
      email: auth.currentUser.email || profile?.email || '',
    });
    setProfile((prev) =>
      prev
        ? { ...prev, name: trimmed, updatedAt: new Date().toISOString() }
        : null
    );
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signUpWithEmail,
        signInWithEmail,
        signInWithGoogle,
        logout,
        updateDisplayName,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
