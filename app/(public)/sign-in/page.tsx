import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

import SignIn from "@/components/Auth/SignIn";

export default async function SignInPage() {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();

  if (data?.session) {
    redirect("/");
  }

  return <SignIn />;
}
