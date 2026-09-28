"use client";

import { useTranslation } from "@prostcounter/shared/i18n";
import type { WrappedData } from "@prostcounter/shared/wrapped";
import { Download, HeartHandshake } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { Button } from "@/components/ui/button";

import { BaseSlide, SlideSubtitle, SlideTitle } from "./BaseSlide";

interface OutroSlideProps {
  data: WrappedData;
  isActive?: boolean;
}

export function OutroSlide({ data, isActive = false }: OutroSlideProps) {
  const { t } = useTranslation();
  const router = useRouter();

  const handleDownload = useCallback(() => {
    // Store wrapped data in localStorage for the share page
    localStorage.setItem("wrapped-share-data-v2", JSON.stringify(data));

    // Navigate to dedicated share page
    router.push("/wrapped/share");
  }, [data, router]);

  return (
    <BaseSlide isActive={isActive} className="bg-gradient-to-br from-yellow-50 to-orange-50">
      <div className="flex flex-col items-center gap-4">
        <HeartHandshake className="size-16" />

        <SlideTitle className="text-5xl">{t("wrapped.outro.title")}</SlideTitle>

        <SlideSubtitle>{t("wrapped.outro.subtitle")}</SlideSubtitle>

        <div className="max-w-md rounded-lg bg-white p-6 text-center shadow-lg">
          <p className="mb-2 text-lg font-semibold text-gray-800">
            {t("wrapped.outro.summary.beers", {
              count: data.basicStats.totalBeers,
            })}{" "}
            &{" "}
            {t("wrapped.outro.summary.tents", {
              count: data.tentStats.uniqueTents,
            })}
          </p>
          <p className="text-gray-600">
            {t("wrapped.outro.summary.across", {
              days: t("wrapped.outro.summary.days", {
                count: data.basicStats.daysAttended,
              }),
              festival: data.festivalInfo.name,
            })}
          </p>
        </div>

        <Button
          onClick={handleDownload}
          size="lg"
          className="mt-6 bg-yellow-500 px-8 font-semibold text-white hover:bg-yellow-600"
        >
          <Download className="mr-2 h-5 w-5" />
          {t("wrapped.outro.share")}
        </Button>
        <p className="text-muted-foreground text-xs">
          {t("wrapped.outro.shareHint")}
        </p>

        <div className="mt-2 text-center text-sm text-gray-500">
          <p>{t("wrapped.outro.madeWith")}</p>
        </div>
      </div>
    </BaseSlide>
  );
}
