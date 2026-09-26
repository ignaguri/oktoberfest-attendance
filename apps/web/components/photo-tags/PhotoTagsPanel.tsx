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

/** Whose photo it is and who is in it; the uploader of a public photo can change the tags. */
export function PhotoTagsPanel({ photoId, groupId }: PhotoTagsPanelProps) {
  const { t } = useTranslation();
  const { data: tags } = usePhotoTags(photoId);
  const { mutateAsync: setPhotoTags } = useSetPhotoTags();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [draftUserIds, setDraftUserIds] = useState<string[]>([]);

  const taggedUsers = tags?.taggedUsers ?? [];
  const canEdit = !!tags?.canEdit && !!tags.festivalId;

  if (!tags) {
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
    <div className="flex flex-col gap-2 border-b px-4 py-3">
      <p className="text-sm text-gray-500">
        {t("photoTags.photoByPrefix")}{" "}
        <Link
          href={`/user/${tags.uploader.userId}`}
          className="font-semibold text-gray-900 hover:underline"
        >
          {tags.uploader.username || tags.uploader.fullName}
        </Link>
      </p>
      {(taggedUsers.length > 0 || canEdit) && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm text-gray-500">{t("photoTags.inThisPhoto")}</span>
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
      )}
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
