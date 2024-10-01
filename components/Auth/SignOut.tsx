"use client";

import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

import { logout } from "./actions";

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
      <LogOut size={20} />
      <span className="hidden sm:block">Sign Out</span>
    </Button>
  );
}
