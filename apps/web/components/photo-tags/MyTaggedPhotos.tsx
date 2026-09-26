"use client";

import { useFestival } from "@prostcounter/shared/contexts";
import { useCurrentProfile } from "@prostcounter/shared/hooks";

import { useTranslation } from "@/lib/i18n/client";

import { TaggedPhotosStrip } from "./TaggedPhotosStrip";

/** "Photos of you" for the signed-in user's own profile page. */
export function MyTaggedPhotos() {
  const { t } = useTranslation();
  const { data: profile } = useCurrentProfile();
  const { currentFestival } = useFestival();

  return (
    <TaggedPhotosStrip
      userId={profile?.id}
      festivalId={currentFestival?.id}
      title={t("photoTags.strip.titleSelf")}
    />
  );
}
