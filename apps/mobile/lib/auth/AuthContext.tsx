import * as Sentry from "@sentry/react-native";
import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { identifyDevice } from "vexo-analytics";

import { clearAllData } from "@/lib/database/debug";
import { getDatabase } from "@/lib/database/init";
import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";

import {
  signInWithApple as appleSignIn,
  signInWithFacebook as facebookSignIn,
  signInWithGoogle as googleSignIn,
} from "./oauth";
import {
  clearAllAuthData,
  clearSession,
  getStoredSession,
  storeSession,
  storeUserEmail,
} from "./secure-storage";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  /** Restore session from stored tokens (for biometric auth) */
  restoreSession: () => Promise<{ error: Error | null }>;
  // OAuth methods
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithFacebook: () => Promise<{ error: Error | null }>;
  signInWithApple: () => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** A SIGNED_OUT the user did not trigger means the library evicted a dead session. */
export function isDeadSessionSignOut(event: string, userInitiated: boolean): boolean {
  return event === "SIGNED_OUT" && !userInitiated;
}

/**
 * Runs a user-initiated sign-out, marking the ref so the auth listener can tell
 * this SIGNED_OUT apart from a library-driven dead-session eviction. On success
 * the ref stays set until the SIGNED_OUT event clears it. If the sign-out call
 * throws, no SIGNED_OUT event will arrive to clear the ref, so clear it here;
 * otherwise a later genuine eviction would be misclassified and its warning
 * suppressed. Reset only on the failure path, never in a finally: a finally
 * would clear the ref before the async SIGNED_OUT lands and mislabel a real
 * user sign-out as a dead session.
 */
export async function runUserSignOut(
  userInitiatedRef: { current: boolean },
  signOut: () => Promise<unknown>,
): Promise<void> {
  userInitiatedRef.current = true;
  try {
    await signOut();
  } catch (error) {
    userInitiatedRef.current = false;
    throw error;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const userInitiatedSignOutRef = useRef(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);

      // Set Sentry user context for initial session
      if (session?.user) {
        Sentry.setUser({
          id: session.user.id,
          email: session.user.email,
        });
        identifyDevice(session.user.id);
      }

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
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (isDeadSessionSignOut(event, userInitiatedSignOutRef.current)) {
        Sentry.captureMessage("Session expired: signed out by auth library", {
          level: "warning",
          tags: { source: "auth", reason: "dead_session" },
        });
      }
      if (event === "SIGNED_OUT") {
        userInitiatedSignOutRef.current = false;
      }

      setSession(session);

      // Set Sentry user context for error tracking
      if (session?.user) {
        Sentry.setUser({
          id: session.user.id,
          email: session.user.email,
        });
        identifyDevice(session.user.id);
      } else {
        Sentry.setUser(null);
        identifyDevice(null);
      }

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
    await runUserSignOut(userInitiatedSignOutRef, () => supabase.auth.signOut());
    await clearAllAuthData();
    // Clear local SQLite data to avoid stale data from previous user session
    try {
      const db = getDatabase();
      await clearAllData(db);
    } catch (error) {
      logger.error("[Auth] Failed to clear database on sign out:", error);
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "prostcounter://reset-password",
    });
    return { error: error as Error | null };
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { error: error as Error | null };
  }, []);

  const restoreSession = useCallback(async () => {
    const { accessToken, refreshToken } = await getStoredSession();
    if (!accessToken || !refreshToken) {
      return { error: new Error("No stored session") };
    }

    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
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
        restoreSession,
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
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
