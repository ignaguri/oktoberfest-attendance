"use client";

import { usePhotoTags, useSetPhotoTags } from "@prostcounter/shared/hooks";
import { UserPlus } from "lucide-react";
import { Link } from "next-view-transitions";
import { useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/lib/i18n/client";

import { PhotoTagPicker } from "./PhotoTagPicker";

interface PhotoTagsPanelProps {
  photoId: string;
  groupId?: string;
}

/** Tagged people under a photo; the uploader of a public photo can change them. */
export function PhotoTagsPanel({ photoId, groupId }: PhotoTagsPanelProps) {
  const { t } = useTranslation();
  const { data: tags } = usePhotoTags(photoId);
  const { mutateAsync: setPhotoTags } = useSetPhotoTags();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [draftUserIds, setDraftUserIds] = useState<string[]>([]);

  const taggedUsers = tags?.taggedUsers ?? [];
  const canEdit = !!tags?.canEdit && !!tags.festivalId;

  if (taggedUsers.length === 0 && !canEdit) {
    return null;
  }

  const handleOpenChange = async (open: boolean) => {
    if (open) {
      setDraftUserIds(taggedUsers.map((user) => user.userId));
      setIsPickerOpen(true);
      return;
    }
    setIsPickerOpen(false);
    const current = taggedUsers.map((user) => user.userId);
    const changed =
      current.length !== draftUserIds.length || current.some((id) => !draftUserIds.includes(id));
    if (!changed) {
      return;
    }
    try {
      await setPhotoTags({ photoId, userIds: draftUserIds, groupId });
    } catch {
      toast.error(t("photoTags.saveFailed"));
    }
  };

  return (
    <div className="border-b px-4 py-3">
      <h3 className="mb-2 text-sm font-semibold text-gray-900">{t("photoTags.taggedLabel")}</h3>
      <div className="flex flex-wrap gap-1.5">
        {taggedUsers.map((user) => (
          <Link
            key={user.userId}
            href={`/user/${user.userId}`}
            className="rounded-full bg-gray-100 px-2.5 py-1 text-sm text-gray-700 hover:bg-gray-200"
          >
            {user.username || user.fullName}
          </Link>
        ))}
        {canEdit && (
          <button
            type="button"
            onClick={() => handleOpenChange(true)}
            className="flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-sm text-gray-600 hover:bg-gray-50"
          >
            <UserPlus className="size-3.5" />
            {t("photoTags.tagPeople")}
          </button>
        )}
      </div>
      {canEdit && (
        <PhotoTagPicker
          open={isPickerOpen}
          onOpenChange={handleOpenChange}
          festivalId={tags?.festivalId ?? undefined}
          selectedUserIds={draftUserIds}
          onChange={setDraftUserIds}
        />
      )}
    </div>
  );
}
