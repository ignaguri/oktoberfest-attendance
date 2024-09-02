import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

import UpdatePassword from "@/components/Auth/UpdatePassword";

export default async function UpdatePasswordPage() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/sign-in");
  }

  return <UpdatePassword />;
}
