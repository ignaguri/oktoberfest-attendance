"use client";

import type { WrappedData } from "@/lib/wrapped/types";

import {
  BaseSlide,
  SlideTitle,
  SlideSubtitle,
  SlideContent,
  StatItem,
} from "./BaseSlide";

interface SocialSlideProps {
  data: WrappedData;
}

export function SocialSlide({ data }: SocialSlideProps) {
  const { groups_joined, photos_uploaded, total_group_members } =
    data.social_stats;

  return (
    <BaseSlide className="bg-gradient-to-br from-indigo-50 to-purple-50">
      <SlideTitle>Social Butterfly</SlideTitle>
      <SlideSubtitle>Your social impact</SlideSubtitle>

      <SlideContent className="space-y-4">
        <StatItem icon="👥" label="Groups Joined" value={groups_joined} />

        <StatItem icon="📸" label="Photos Uploaded" value={photos_uploaded} />

        <StatItem
          icon="🤝"
          label="Festival Friends"
          value={total_group_members}
        />
      </SlideContent>
    </BaseSlide>
  );
}
