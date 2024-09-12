"use client";

import Image from "next/image";

import LogoutIcon from "@/public/icons/logout-icon-fa.svg";
import { logout } from "./actions";
import { Button } from "@/components/ui/button";

const ICON_SIZE = 20;

export default function SignOut() {
  async function handleSignOut() {
    await logout();
  }

  return (
    <Button
      type="button"
      variant="yellow"
      onClick={handleSignOut}
      title="Sign out"
      className="px-2 py-2 sm:px-8 flex gap-1 items-center"
    >
      <Image
        width={ICON_SIZE}
        height={ICON_SIZE}
        src={LogoutIcon}
        alt="Sign out"
        style={{ height: ICON_SIZE, width: ICON_SIZE }}
        priority
      />
      <span className="hidden sm:block">Sign Out</span>
    </Button>
  );
}
