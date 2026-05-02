"use client";

import { useTranslation } from "@prostcounter/shared/i18n";
import type { WrappedData } from "@prostcounter/shared/wrapped";
import { Beer, Download, Heart, HeartHandshake } from "lucide-react";
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
    localStorage.setItem("wrapped-share-data", JSON.stringify(data));

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
              count: data.basic_stats.total_beers,
            })}{" "}
            &{" "}
            {t("wrapped.outro.summary.tents", {
              count: data.tent_stats.unique_tents,
            })}
          </p>
          <p className="text-gray-600">
            {t("wrapped.outro.summary.across", {
              days: t("wrapped.outro.summary.days", {
                count: data.basic_stats.days_attended,
              }),
              festival: data.festival_info.name,
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
          Click to generate a shareable summary of your festival experience
        </p>

        <div className="mt-2 text-center text-sm text-gray-500">
          <p className="flex items-center gap-1">
            Made with <Heart className="size-4" /> and some <Beer className="size-4" /> by
            ProstCounter
          </p>
        </div>
      </div>
    </BaseSlide>
  );
}
