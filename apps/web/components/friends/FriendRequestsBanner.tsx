"use client";

import { useFriendRequests } from "@prostcounter/shared/hooks";
import type { FriendRequest } from "@prostcounter/shared/schemas";
import { UserPlus } from "lucide-react";
import { Link } from "next-view-transitions";

import { IncomingRequestCard } from "@/components/friends/FriendRequests";
import { useTranslation } from "@/lib/i18n/client";

/** More than this and the rest wait behind "See all", so Home stays short */
const MAX_VISIBLE_REQUESTS = 2;

/**
 * Incoming friend requests on Home, answerable in place. Renders nothing when
 * there are none, so Home can mount it unconditionally.
 */
export function FriendRequestsBanner() {
  const { t } = useTranslation();
  const { data } = useFriendRequests();

  const requests = (data as FriendRequest[] | undefined) ?? [];
  if (requests.length === 0) {
    return null;
  }

  return (
    <section className="w-full space-y-2 text-left">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <UserPlus className="size-4 text-yellow-600" />
          {t("friends.homeBanner.title", { count: requests.length })}
        </h2>
        {requests.length > MAX_VISIBLE_REQUESTS && (
          <Link href="/friends" className="text-sm font-medium text-yellow-600 hover:underline">
            {t("friends.homeBanner.seeAll")}
          </Link>
        )}
      </div>
      {requests.slice(0, MAX_VISIBLE_REQUESTS).map((request) => (
        <IncomingRequestCard key={request.id} request={request} />
      ))}
    </section>
  );
}
