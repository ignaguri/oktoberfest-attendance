import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

import ResetPassword from "@/components/Auth/ResetPassword";

export default async function ResetPasswordPage() {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();

  if (data?.session) {
    redirect("/");
  }

  return <ResetPassword />;
}
