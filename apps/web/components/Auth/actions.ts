"use server";

import "server-only";

import { isCaptchaRejection } from "@prostcounter/shared/utils";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  CAPTCHA_REJECTED_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  reportSupabaseAuthException,
} from "@/utils/sentry";
import { createClient } from "@/utils/supabase/server";

function revalidateBase() {
  revalidatePath("/");
  revalidatePath("/", "layout");
  revalidatePath("/home");
}

export async function login(
  formData: { email: string; password: string },
  redirectTo?: string | null,
  captchaToken?: string,
) {
  const supabase = await createClient();

  const data = {
    email: formData.email,
    password: formData.password,
    ...(captchaToken ? { options: { captchaToken } } : {}),
  };

  const { error } = await supabase.auth.signInWithPassword(data);

  if (error) {
    reportSupabaseAuthException("login", error, { email: formData.email });

    // A captcha rejection is not a credentials problem, and collapsing it into
    // one sends the user back to retype a password that was already correct.
    // It also reveals nothing about the account, so it is safe to surface.
    if (isCaptchaRejection(error)) {
      throw new Error(CAPTCHA_REJECTED_MESSAGE);
    }

    // Don't reveal if email exists - use generic message
    throw new Error(INVALID_CREDENTIALS_MESSAGE);
  }

  revalidateBase();

  if (redirectTo) {
    redirect(redirectTo);
  } else {
    redirect("/home");
  }
}

export async function logout() {
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    reportSupabaseAuthException("logout", error);
    redirect("/error");
  }

  revalidateBase();
  redirect("/");
}

export async function signUp(formData: { email: string; password: string }, captchaToken?: string) {
  const supabase = await createClient();

  const data = {
    email: formData.email,
    password: formData.password,
    ...(captchaToken ? { options: { captchaToken } } : {}),
  };

  const { error } = await supabase.auth.signUp(data);

  if (error) {
    reportSupabaseAuthException("signUp", error, { email: formData.email });
    throw new Error(error.message);
  }
}

export async function resetPassword(
  formData: {
    email: string;
  },
  captchaToken?: string,
): Promise<[boolean, string | null]> {
  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(
    formData.email,
    captchaToken ? { captchaToken } : undefined,
  );

  if (error) {
    reportSupabaseAuthException("resetPassword", error, {
      email: formData.email,
    });
    return [false, error.message];
  } else {
    return [true, null];
  }
}

export async function updatePassword(formData: { password: string }) {
  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password: formData.password,
  });

  if (error) {
    reportSupabaseAuthException("updatePassword", error);
    throw new Error(error.message);
  }

  revalidateBase();
}

export async function signInWithOAuth(
  provider: "google" | "facebook" | "apple",
  redirectTo?: string | null,
) {
  const supabase = await createClient();

  let baseUrl: string | undefined;
  if (process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URL) {
    baseUrl = process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URL;
  } else if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    baseUrl = `https://${process.env.NEXT_PUBLIC_VERCEL_URL}/auth/callback`;
  } else if (process.env.NODE_ENV === "development") {
    baseUrl = "http://localhost:3008/auth/callback";
  } else {
    throw new Error(
      "OAuth redirect URL is not configured. Please set NEXT_PUBLIC_OAUTH_REDIRECT_URL or NEXT_PUBLIC_VERCEL_URL in your environment variables.",
    );
  }

  const finalRedirectUrl = redirectTo
    ? `${baseUrl}?redirect=${encodeURIComponent(redirectTo)}`
    : baseUrl;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: finalRedirectUrl,
    },
  });

  if (error) {
    reportSupabaseAuthException("signInWithOAuth", error, { provider });
    throw new Error(error.message);
  }

  if (data.url) {
    redirect(data.url);
  }

  return data;
}
