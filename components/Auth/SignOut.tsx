"use client";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Image from "next/image";

import LogoutIcon from "@/public/icons/logout-icon-fa.svg";

const ICON_SIZE = 20;

export default function SignOut() {
  const supabase = createClientComponentClient();

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Error signing out:", error);
    }
  }

  return (
    <button
      type="button"
      className="button-inverse px-2 py-2 sm:px-8 flex gap-1 items-center"
      onClick={handleSignOut}
      title="Sign out"
    >
      <Image
        width={ICON_SIZE}
        height={ICON_SIZE}
        src={LogoutIcon}
        alt="Sign out"
        style={{ height: ICON_SIZE, width: ICON_SIZE }}
      />
      <span className="hidden sm:block">Sign Out</span>
    </button>
  );
}
