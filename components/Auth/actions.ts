"use server";

import { reportLog } from "@/utils/sentry";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import "server-only";

function revalidateBase() {
  revalidatePath("/");
  revalidatePath("/", "layout");
  revalidatePath("/home");
}

export async function login(
  formData: { email: string; password: string },
  redirectTo?: string | null,
) {
  const supabase = createClient();

  const data = {
    email: formData.email,
    password: formData.password,
  };

  const { error } = await supabase.auth.signInWithPassword(data);

  if (error) {
    reportLog(
      `Error trying to log in: email=${formData.email}; error=${error.message}`,
      "error",
    );
    throw new Error(error.message);
  }

  revalidateBase();

  if (redirectTo) {
    redirect(redirectTo);
  } else {
    redirect("/home");
  }
}

export async function logout() {
  const supabase = createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    reportLog(`Error trying to log out: ${error.message}`, "error");
    redirect("/error");
  }

  revalidateBase();
  redirect("/");
}

export async function signUp(formData: { email: string; password: string }) {
  const supabase = createClient();

  const data = {
    email: formData.email,
    password: formData.password,
  };

  const { error } = await supabase.auth.signUp(data);

  if (error) {
    reportLog(
      `Error trying to sign up: email=${formData.email}; error=${error.message}`,
      "error",
    );
    throw new Error(error.message);
  }
}

export async function resetPassword(formData: {
  email: string;
}): Promise<[boolean, string | null]> {
  const supabase = createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(formData.email);

  if (error) {
    reportLog(
      `Error trying to reset password: email=${formData.email}; error=${error.message}`,
      "error",
    );
    return [false, error.message];
  } else {
    return [true, null];
  }
}

export async function updatePassword(formData: { password: string }) {
  const supabase = createClient();

  const { error } = await supabase.auth.updateUser({
    password: formData.password,
  });

  if (error) {
    reportLog(`Error trying to update password: ${error.message}`, "error");
    throw new Error(error.message);
  }

  revalidateBase();
}
