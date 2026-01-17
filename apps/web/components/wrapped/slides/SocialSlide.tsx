"use client";

import { Camera, Users, UserSearch } from "lucide-react";

import type { WrappedData } from "@/lib/wrapped/types";

import {
  BaseSlide,
  SlideContent,
  SlideSubtitle,
  SlideTitle,
  StatItem,
} from "./BaseSlide";

interface SocialSlideProps {
  data: WrappedData;
  isActive?: boolean;
}

export function SocialSlide({ data, isActive = false }: SocialSlideProps) {
  const { groups_joined, photos_uploaded, total_group_members } =
    data.social_stats;

  return (
    <BaseSlide
      isActive={isActive}
      className="bg-gradient-to-br from-indigo-50 to-purple-50"
    >
      <SlideTitle>Social butterfly</SlideTitle>
      <SlideSubtitle>Your social impact</SlideSubtitle>

      <SlideContent className="flex flex-col gap-4">
        <StatItem
          icon={<UserSearch className="size-5" />}
          label="Groups joined"
          value={groups_joined}
        />

        <StatItem
          icon={<Camera className="size-5" />}
          label="Photos uploaded"
          value={photos_uploaded}
        />

        <StatItem
          icon={<Users className="size-5" />}
          label="Festival friends"
          value={total_group_members}
        />
      </SlideContent>
    </BaseSlide>
  );
}
