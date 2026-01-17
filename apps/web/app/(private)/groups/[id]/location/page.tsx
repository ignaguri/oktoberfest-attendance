import { Link } from "next-view-transitions";

import { GroupMembersMap } from "@/components/LocationSharing";
import { getTranslations } from "@/lib/i18n/server";

export default async function GroupLocationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = getTranslations();

  return (
    <div className="w-full max-w-lg">
      <div className="mb-4 flex items-center justify-center">
        <h2 className="text-2xl font-bold">{t("groups.location.title")}</h2>
      </div>

      <GroupMembersMap radiusMeters={1000} />

      <div className="mt-4 space-y-2 text-center">
        <p className="text-muted-foreground text-sm">
          {t("groups.location.shareDescription")}
        </p>
        <p className="text-muted-foreground text-xs">
          {t("groups.location.controlNote")}{" "}
          <Link href="/profile" className="underline hover:no-underline">
            {t("profile.sections.privacy")}
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
