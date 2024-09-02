import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

import SignUp from "@/components/Auth/SignUp";

export default async function SignUpPage() {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();

  if (data?.session) {
    redirect("/");
  }

  return <SignUp />;
}
