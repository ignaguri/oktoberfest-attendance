import Link from "next/link";
import SignOut from "./Auth/SignOut";
import AvatarForSession from "./AvatarForSession";

import type { MaybeSession } from "@/lib/types";

interface NavbarProps {
  session: MaybeSession;
}

export default function Navbar({ session }: NavbarProps) {
  return (
    <nav className="w-full bg-gray-800 shadow">
      <div className="justify-between items-center flex px-4 sm:px-8 py-2 sm:py-4">
        <Link className="text-base sm:text-xl text-white font-bold" href="/">
          ProstCounter 🍻
        </Link>
        {session && (
          <div className="flex gap-2 items-center">
            <Link href="/profile">
              <AvatarForSession session={session} size="small" />
            </Link>
            <SignOut />
          </div>
        )}
      </div>
    </nav>
  );
}
