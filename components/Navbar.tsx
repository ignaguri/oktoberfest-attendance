import Avatar from "@/components/Avatar/Avatar";
import { getProfileShortFailsafe } from "@/lib/sharedActions";
import { Link } from "next-view-transitions";

import SignOut from "./Auth/SignOut";
import { FestivalSelector } from "./FestivalSelector";

export default async function Navbar() {
  const profileData = await getProfileShortFailsafe();

  return (
    <nav className="w-full bg-gray-800 shadow-sm">
      <div className="justify-between items-center flex px-4 sm:px-8 py-2 sm:py-4">
        <Link className="text-base sm:text-xl text-white font-bold" href="/">
          ProstCounter 🍻
        </Link>

        {/* Festival Selector - center area */}
        {profileData && (
          <div className="hidden sm:block">
            <FestivalSelector />
          </div>
        )}

        {profileData && (
          <div className="flex gap-2 items-center">
            {/* Mobile festival selector */}
            <div className="sm:hidden">
              <FestivalSelector />
            </div>
            <Link href="/profile">
              <Avatar
                url={profileData.avatar_url}
                fallback={{
                  username: profileData.username,
                  full_name: profileData.full_name,
                  email: profileData.email || "no.name@user.com",
                }}
              />
            </Link>
            <SignOut />
          </div>
        )}
        {!profileData && (
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
