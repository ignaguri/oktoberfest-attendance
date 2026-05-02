"use client";

import { useTranslation } from "@prostcounter/shared/i18n";
import type { WrappedData } from "@prostcounter/shared/wrapped";
import { Camera, Users, UserSearch } from "lucide-react";

import { BaseSlide, SlideContent, SlideSubtitle, SlideTitle, StatItem } from "./BaseSlide";

interface SocialSlideProps {
  data: WrappedData;
  isActive?: boolean;
}

export function SocialSlide({ data, isActive = false }: SocialSlideProps) {
  const { t } = useTranslation();
  const { groups_joined, photos_uploaded, total_group_members } = data.social_stats;

  return (
    <BaseSlide isActive={isActive} className="bg-gradient-to-br from-indigo-50 to-purple-50">
      <SlideTitle>{t("wrapped.social.title")}</SlideTitle>
      <SlideSubtitle>{t("wrapped.social.subtitle")}</SlideSubtitle>

      <SlideContent className="flex flex-col gap-4">
        <StatItem
          icon={<UserSearch className="size-5" />}
          label={t("wrapped.social.groups")}
          value={groups_joined}
        />

        <StatItem
          icon={<Camera className="size-5" />}
          label={t("wrapped.social.photos")}
          value={photos_uploaded}
        />

        <StatItem
          icon={<Users className="size-5" />}
          label={t("wrapped.social.friends")}
          value={total_group_members}
        />
      </SlideContent>
    </BaseSlide>
  );
}
