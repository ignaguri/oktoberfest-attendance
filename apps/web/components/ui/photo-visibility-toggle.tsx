"use client";

import type { PhotoVisibility } from "@prostcounter/shared/schemas";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { apiClient } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

interface PhotoVisibilityToggleProps {
  photoId: string;
  currentVisibility: PhotoVisibility;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function PhotoVisibilityToggle({
  photoId,
  currentVisibility,
  size = "md",
  showLabel = true,
  className = "",
}: PhotoVisibilityToggleProps) {
  const { t } = useTranslation();
  const [visibility, setVisibility] =
    useState<PhotoVisibility>(currentVisibility);
  const [isLoading, setIsLoading] = useState(false);

  const isPublic = visibility === "public";

  const handleToggle = async () => {
    setIsLoading(true);
    const newVisibility: PhotoVisibility = isPublic ? "private" : "public";

    try {
      await apiClient.photos.updateVisibility(photoId, newVisibility);
      setVisibility(newVisibility);

      toast.success(t("notifications.success.photoVisibilityUpdated"), {
        description:
          newVisibility === "public"
            ? t("notifications.descriptions.photoVisibilityPublic")
            : t("notifications.descriptions.photoVisibilityPrivate"),
      });
    } catch {
      toast.error(t("common.status.error"), {
        description: t("photo.privacy.updateError"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const iconSize = {
    sm: 14,
    md: 16,
    lg: 20,
  }[size];

  return (
    <div className={cn(`flex items-center gap-2`, className)}>
      {isPublic ? (
        <Eye size={iconSize} className="text-green-600" />
      ) : (
        <EyeOff size={iconSize} className="text-red-600" />
      )}

      <Switch
        checked={isPublic}
        onCheckedChange={handleToggle}
        disabled={isLoading}
      />

      {showLabel && (
        <span
          className={cn(size === "sm" ? "text-xs" : "text-sm", "font-medium")}
        >
          {isPublic
            ? t("photo.visibility.public")
            : t("photo.visibility.private")}
        </span>
      )}
    </div>
  );
}
