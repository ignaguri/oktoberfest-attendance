import Link from "next/link";
import SignOut from "./Auth/SignOut";

import { createClient } from "@/utils/supabase/server";
import Avatar from "@/components/Avatar/Avatar";

const getUserAndAvatarUrl = async () => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, avatarUrl: null };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(`avatar_url`)
    .eq("id", user.id)
    .single();

  if (error) {
    throw error;
  }

  return { user, avatarUrl: data.avatar_url };
};

export default async function Navbar() {
  const { user, avatarUrl } = await getUserAndAvatarUrl();

  return (
    <nav className="w-full bg-gray-800 shadow">
      <div className="justify-between items-center flex px-4 sm:px-8 py-2 sm:py-4">
        <Link className="text-base sm:text-xl text-white font-bold" href="/">
          ProstCounter 🍻
        </Link>
        {user && (
          <div className="flex gap-2 items-center">
            <Link href="/profile">
              <Avatar url={avatarUrl} size="small" />
            </Link>
            <SignOut />
          </div>
        )}
        {!user && (
          <div className="h-10 flex items-center">
            <Link href="/sign-in" className="text-white">
              Sign In
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
