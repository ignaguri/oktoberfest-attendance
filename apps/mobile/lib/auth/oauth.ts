import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '@/lib/supabase';
import { Platform } from 'react-native';

// Complete the auth session to enable browser redirect handling
WebBrowser.maybeCompleteAuthSession();

/**
 * OAuth redirect URI for the app.
 * Uses the 'prostcounter' scheme defined in app.json.
 */
export const redirectUri = AuthSession.makeRedirectUri({
  scheme: 'prostcounter',
  path: 'auth/callback',
});

/**
 * Sign in with Google OAuth
 */
export async function signInWithGoogle(): Promise<{
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      return { error };
    }

    if (!data.url) {
      return { error: new Error('No OAuth URL returned') };
    }

    // Open browser for OAuth flow
    const result = await WebBrowser.openAuthSessionAsync(
      data.url,
      redirectUri,
      {
        showInRecents: true,
      }
    );

    if (result.type === 'success') {
      // Extract the tokens from the URL
      const url = result.url;
      const params = new URLSearchParams(url.split('#')[1] || url.split('?')[1]);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken && refreshToken) {
        // Set the session with the tokens
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          return { error: sessionError };
        }
      }
    } else if (result.type === 'cancel') {
      return { error: new Error('Authentication was cancelled') };
    }

    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err : new Error('Google sign-in failed') };
  }
}

/**
 * Sign in with Facebook OAuth
 */
export async function signInWithFacebook(): Promise<{
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      return { error };
    }

    if (!data.url) {
      return { error: new Error('No OAuth URL returned') };
    }

    // Open browser for OAuth flow
    const result = await WebBrowser.openAuthSessionAsync(
      data.url,
      redirectUri,
      {
        showInRecents: true,
      }
    );

    if (result.type === 'success') {
      // Extract the tokens from the URL
      const url = result.url;
      const params = new URLSearchParams(url.split('#')[1] || url.split('?')[1]);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken && refreshToken) {
        // Set the session with the tokens
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          return { error: sessionError };
        }
      }
    } else if (result.type === 'cancel') {
      return { error: new Error('Authentication was cancelled') };
    }

    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err : new Error('Facebook sign-in failed') };
  }
}

/**
 * Sign in with Apple (iOS only)
 */
export async function signInWithApple(): Promise<{
  error: Error | null;
}> {
  if (Platform.OS !== 'ios') {
    return { error: new Error('Apple Sign-In is only available on iOS') };
  }

  try {
    // Request credentials from Apple
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    // Sign in with Supabase using the Apple ID token
    if (credential.identityToken) {
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (error) {
        return { error };
      }
    } else {
      return { error: new Error('No identity token received from Apple') };
    }

    return { error: null };
  } catch (err: any) {
    // Handle Apple-specific errors
    if (err.code === 'ERR_REQUEST_CANCELED') {
      return { error: new Error('Authentication was cancelled') };
    }
    return { error: err instanceof Error ? err : new Error('Apple sign-in failed') };
  }
}
