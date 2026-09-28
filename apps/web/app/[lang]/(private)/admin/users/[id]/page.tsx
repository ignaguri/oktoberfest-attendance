"use client";

import { useAdminUser } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { useParams } from "next/navigation";
import { Link } from "next-view-transitions";

import UserTimeline from "../../components/analytics/UserTimeline";

export default function AdminUserTimelinePage() {
  const { t } = useTranslation();
  const params = useParams();
  const userId = params.id as string;
  const { user } = useAdminUser(userId);

  const name = user?.profile?.full_name ?? user?.profile?.username ?? userId;

  return (
    <div className="container mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <Link href="/admin#analytics" className="text-sm text-muted-foreground hover:underline">
        ← {t("admin.pageTitle")}
      </Link>
      <div className="flex flex-col">
        <h1 className="text-2xl font-semibold">{name}</h1>
        {user?.profile?.username && (
          <p className="text-sm text-muted-foreground">@{user.profile.username}</p>
        )}
        <p className="text-sm text-muted-foreground">{t("admin.analytics.timeline.openHint")}</p>
      </div>
      <UserTimeline userId={userId} />
    </div>
  );
}
