import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

import AccountForm from "./AccountForm";

export default async function Profile() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  return <AccountForm user={user} />;
}
