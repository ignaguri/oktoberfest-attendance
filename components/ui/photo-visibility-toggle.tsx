"use client";

import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { updatePhotoVisibility } from "@/lib/actions/photo-visibility";
import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import type { Database } from "@/lib/database.types";

type PhotoVisibility = Database["public"]["Enums"]["photo_visibility_enum"];

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
  const [visibility, setVisibility] =
    useState<PhotoVisibility>(currentVisibility);
  const [isLoading, setIsLoading] = useState(false);

  const isPublic = visibility === "public";

  const handleToggle = async () => {
    setIsLoading(true);
    const newVisibility: PhotoVisibility = isPublic ? "private" : "public";

    try {
      await updatePhotoVisibility(photoId, newVisibility);
      setVisibility(newVisibility);

      toast({
        variant: "success",
        title: "Photo visibility updated",
        description: `Photo is now ${newVisibility}`,
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update photo visibility",
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
        size={size}
      />

      {showLabel && (
        <span
          className={cn(size === "sm" ? "text-xs" : "text-sm", "font-medium")}
        >
          {isPublic ? "Public" : "Private"}
        </span>
      )}
    </div>
  );
}
