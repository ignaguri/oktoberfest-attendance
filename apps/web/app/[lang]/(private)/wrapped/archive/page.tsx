"use client";

import { useWrappedFestivals } from "@prostcounter/shared/hooks";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WrappedFestivalList } from "@/components/wrapped/archive/WrappedFestivalList";
import { useTranslation } from "@/lib/i18n/client";

export default function WrappedArchivePage() {
  const { t } = useTranslation();
  const { data: festivals } = useWrappedFestivals();

  return (
    <Card className="mx-auto mt-6 w-full max-w-lg">
      <CardHeader>
        <CardTitle>{t("profile.wrappedArchive.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <WrappedFestivalList festivals={festivals ?? []} />
      </CardContent>
    </Card>
  );
}
