"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";

export async function login(formData: { email: string; password: string }) {
  const supabase = createClient();

  const data = {
    email: formData.email,
    password: formData.password,
  };

  const { error } = await supabase.auth.signInWithPassword(data);

  if (error) {
    redirect("/error");
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function logout() {
  const supabase = createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Error while trying to log out", error);
    redirect("/error");
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signUp(formData: { email: string; password: string }) {
  const supabase = createClient();

  const data = {
    email: formData.email,
    password: formData.password,
  };

  const { error, data: authData } = await supabase.auth.signUp(data);

  if (error) {
    console.error("Error while trying to sign up", error);
    redirect("/error");
  }

  console.log("authData", authData);

  revalidatePath("/", "layout");
  redirect("/");
}
