"use client";

import { useTranslation } from "@prostcounter/shared/i18n";
import { Link } from "next-view-transitions";

import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100">
      <h1 className="mb-4 text-4xl font-bold">
        {t("common.errors.offline.title")}
      </h1>
      <p className="mb-8 text-xl">{t("common.errors.offline.message")}</p>
      <Button asChild>
        <Link href="/">{t("common.errors.offline.tryAgain")}</Link>
      </Button>
    </div>
  );
}
