"use client";

import { usePlanCompanionOptions } from "@prostcounter/shared/hooks";
import { PHOTO_TAG_LIMIT } from "@prostcounter/shared/schemas";
import { Loader2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "@/lib/i18n/client";
import { getAvatarUrl } from "@/lib/utils";

interface PhotoTagPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  festivalId: string | undefined;
  selectedUserIds: string[];
  onChange: (userIds: string[]) => void;
}

/** Friends and group-mates of the festival, as a checklist capped at PHOTO_TAG_LIMIT. */
export function PhotoTagPicker({
  open,
  onOpenChange,
  festivalId,
  selectedUserIds,
  onChange,
}: PhotoTagPickerProps) {
  const { t } = useTranslation();
  const { data: options, loading } = usePlanCompanionOptions(festivalId, { enabled: open });
  const isAtLimit = selectedUserIds.length >= PHOTO_TAG_LIMIT;
  const users = options?.users ?? [];

  const toggle = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      onChange(selectedUserIds.filter((id) => id !== userId));
    } else {
      onChange([...selectedUserIds, userId]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogTitle>{t("photoTags.picker.title")}</DialogTitle>

        {loading && !options && (
          <div className="flex justify-center py-6">
            <Loader2 className="size-6 animate-spin text-gray-400" />
          </div>
        )}

        {options && users.length === 0 && (
          <p className="py-6 text-center text-sm text-gray-500">{t("photoTags.picker.empty")}</p>
        )}

        {users.length > 0 && (
          <ScrollArea className="max-h-80">
            <ul className="flex flex-col">
              {users.map((user) => {
                const name = user.username || user.fullName || "";
                const checked = selectedUserIds.includes(user.userId);
                return (
                  <li key={user.userId}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-gray-50">
                      <Checkbox
                        checked={checked}
                        disabled={!checked && isAtLimit}
                        onCheckedChange={() => toggle(user.userId)}
                      />
                      <Avatar className="size-7">
                        {user.avatarUrl && (
                          <AvatarImage src={getAvatarUrl(user.avatarUrl) ?? undefined} alt={name} />
                        )}
                        <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{name}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}

        {isAtLimit && (
          <p className="text-center text-xs text-gray-500">
            {t("photoTags.picker.limit", { count: PHOTO_TAG_LIMIT })}
          </p>
        )}

        <Button type="button" variant="darkYellow" onClick={() => onOpenChange(false)}>
          {t("common.buttons.done")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
