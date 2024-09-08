import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export default async function Root() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  redirect("/home");
}
