"use client";

import { useTranslation } from "@prostcounter/shared/i18n";
import { CalendarDays } from "lucide-react";
import Image from "next/image";
import { Link } from "next-view-transitions";

import { Button } from "@/components/ui/button";
import { useCurrentProfile } from "@/hooks/useProfile";
import AppLogo from "@/public/android-chrome-512x512.png";

import { NotificationBell } from "./NotificationBell";
import { PWAReloadButton } from "./PWAReloadButton";
import { UserMenu } from "./UserMenu/UserMenu";

export default function Navbar() {
  const { t } = useTranslation();
  const { data: profileData, loading } = useCurrentProfile();

  return (
    <nav className="w-full bg-gray-800 shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 sm:px-8 sm:py-4">
        <Link
          className="flex items-center gap-2 text-base font-bold text-white sm:text-xl"
          href={profileData ? "/home" : "/"}
        >
          <Image
            src={AppLogo}
            alt="ProstCounter Logo"
            className="size-6"
            priority
          />
          <span translate="no">ProstCounter</span>
        </Link>

        {loading && (
          <div className="flex h-10 items-center">
            <div className="h-8 w-8 animate-pulse rounded-full bg-gray-600" />
          </div>
        )}

        {!loading && profileData && (
          <div className="flex items-center gap-2">
            <PWAReloadButton />
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="px-2 text-white hover:text-gray-600"
              data-tutorial="calendar-nav"
            >
              <Link href="/calendar">
                <CalendarDays size={20} />
              </Link>
            </Button>
            <NotificationBell />
            <div data-tutorial="user-menu">
              <UserMenu
                profileData={{
                  username: profileData.username,
                  full_name: profileData.full_name,
                  email: profileData.email || "no.name@user.com",
                  avatar_url: profileData.avatar_url,
                }}
              />
            </div>
          </div>
        )}

        {!loading && !profileData && (
          <div className="flex h-10 items-center">
            <Link href="/sign-in" className="text-white">
              {t("auth.signIn.title")}
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
