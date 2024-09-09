import { createClient } from "@/utils/supabase/server";
import AccountForm from "./AccountForm";
import LoadingSpinner from "@/components/LoadingSpinner";

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <LoadingSpinner />;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(`full_name, username, avatar_url`)
    .eq("id", user.id)
    .single();

  if (error) {
    throw new Error("Error loading user data!");
  }

  return <AccountForm user={user} profile={data} />;
}
