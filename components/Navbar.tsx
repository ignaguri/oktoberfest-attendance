import { getProfileShortFailsafe } from "@/lib/sharedActions";
import { Link } from "next-view-transitions";

import { NotificationBell } from "./NotificationBell";
import { UserMenu } from "./UserMenu/UserMenu";

export default async function Navbar() {
  const profileData = await getProfileShortFailsafe();

  return (
    <nav className="w-full bg-gray-800 shadow-sm">
      <div className="justify-between items-center flex px-4 sm:px-8 py-2 sm:py-4">
        <Link className="text-base sm:text-xl text-white font-bold" href="/">
          <span translate="no">ProstCounter</span> 🍻
        </Link>

        {profileData && (
          <div className="flex items-center gap-2">
            <NotificationBell />
            <UserMenu
              profileData={{
                username: profileData.username,
                full_name: profileData.full_name,
                email: profileData.email || "no.name@user.com",
                avatar_url: profileData.avatar_url,
              }}
            />
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
