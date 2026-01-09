import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import {
  signInWithGoogle as googleSignIn,
  signInWithFacebook as facebookSignIn,
  signInWithApple as appleSignIn,
} from './oauth';
import {
  storeSession,
  clearSession,
  storeUserEmail,
  clearAllAuthData,
} from './secure-storage';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  // OAuth methods
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithFacebook: () => Promise<{ error: Error | null }>;
  signInWithApple: () => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);

      // Store session tokens if available
      if (session?.access_token && session?.refresh_token) {
        storeSession(session.access_token, session.refresh_token);
        if (session.user?.email) {
          storeUserEmail(session.user.email);
        }
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);

      // Update stored tokens on auth changes
      if (session?.access_token && session?.refresh_token) {
        await storeSession(session.access_token, session.refresh_token);
        if (session.user?.email) {
          await storeUserEmail(session.user.email);
        }
      } else if (!session) {
        // Clear stored session on sign out
        await clearSession();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error as Error | null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    await clearAllAuthData();
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'prostcounter://reset-password',
    });
    return { error: error as Error | null };
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { error: error as Error | null };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    return googleSignIn();
  }, []);

  const signInWithFacebook = useCallback(async () => {
    return facebookSignIn();
  }, []);

  const signInWithApple = useCallback(async () => {
    return appleSignIn();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        isLoading,
        isAuthenticated: !!session,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updatePassword,
        signInWithGoogle,
        signInWithFacebook,
        signInWithApple,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
