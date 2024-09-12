import Link from "next/link";
import SignOut from "./Auth/SignOut";

import { createClient } from "@/utils/supabase/server";
import Avatar from "@/components/Avatar/Avatar";

const getAvatarUrl = async () => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(`avatar_url`)
    .eq("id", user.id)
    .single();

  if (error) {
    throw error;
  }

  if (data) {
    return data.avatar_url;
  }

  return null;
};

export default async function Navbar() {
  const avatarUrl = await getAvatarUrl();

  return (
    <nav className="w-full bg-gray-800 shadow">
      <div className="justify-between items-center flex px-4 sm:px-8 py-2 sm:py-4">
        <Link className="text-base sm:text-xl text-white font-bold" href="/">
          ProstCounter 🍻
        </Link>
        {avatarUrl && (
          <div className="flex gap-2 items-center">
            <Link href="/profile">
              <Avatar url={avatarUrl} size="small" />
            </Link>
            <SignOut />
          </div>
        )}
      </div>
    </nav>
  );
}
