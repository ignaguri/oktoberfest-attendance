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
  const { groupsJoined, photosUploaded, totalGroupMembers } = data.socialStats;

  return (
    <BaseSlide isActive={isActive} className="bg-gradient-to-br from-indigo-50 to-purple-50">
      <SlideTitle>{t("wrapped.social.title")}</SlideTitle>
      <SlideSubtitle>{t("wrapped.social.subtitle")}</SlideSubtitle>

      <SlideContent className="flex flex-col gap-4">
        <StatItem
          icon={<UserSearch className="size-5" />}
          label={t("wrapped.social.groups")}
          value={groupsJoined}
        />

        <StatItem
          icon={<Camera className="size-5" />}
          label={t("wrapped.social.photos")}
          value={photosUploaded}
        />

        <StatItem
          icon={<Users className="size-5" />}
          label={t("wrapped.social.friends")}
          value={totalGroupMembers}
        />
      </SlideContent>
    </BaseSlide>
  );
}
