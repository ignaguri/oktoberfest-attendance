"use client";

import {
  Avatar as AvatarUI,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { cva } from "class-variance-authority";
import React from "react";

import UploadAvatarForm from "./UploadAvatarForm";

interface AvatarProps {
  className?: string;
  isEditing?: boolean;
  uid?: string;
  url: string | null;
  size?: "small" | "medium" | "large";
  onUpload?: (url: string) => void;
  previewUrl?: string | null;
  fallback: {
    username: string | null;
    full_name: string | null;
    email: string;
  };
}

const avatarSizeVariants = cva("", {
  variants: {
    size: {
      small: "h-10 w-10", // 40px
      medium: "h-24 w-24", // 100px
      large: "h-36 w-36", // 150px
    },
  },
  defaultVariants: {
    size: "small",
  },
});

function extractName({ username, full_name, email }: AvatarProps["fallback"]) {
  if (full_name) {
    const [first, last] = full_name.split(" ");
    return {
      initials: `${first[0].toUpperCase()}${last ? last[0].toUpperCase() : ""}`,
      full: full_name,
    };
  }
  if (username) {
    const [first, last] = username.split(" ");
    return {
      initials: `${first[0].toUpperCase()}${last ? last[0].toUpperCase() : ""}`,
      full: username,
    };
  }

  const [first, last] = email.split("@")[0].split(".");
  return {
    initials: `${first[0].toUpperCase()}${last ? last[0].toUpperCase() : ""}`,
    full: email,
  };
}

export function AvatarPreview({
  url,
  previewUrl,
  size = "small",
  fallback,
}: Pick<AvatarProps, "url" | "previewUrl" | "size" | "fallback">) {
  const imageUrl = previewUrl || (url ? `/api/image/${url}` : undefined);
  const { initials, full } = extractName(fallback);

  return (
    <AvatarUI className={avatarSizeVariants({ size })}>
      <AvatarImage src={imageUrl} alt={`${full} avatar`} />
      <AvatarFallback>{initials}</AvatarFallback>
    </AvatarUI>
  );
}

export default function Avatar({
  className,
  isEditing,
  uid,
  url,
  size = "small",
  onUpload,
  previewUrl,
  fallback,
}: AvatarProps) {
  return (
    <div className={className}>
      {!isEditing && (
        <AvatarPreview
          url={url}
          previewUrl={previewUrl}
          size={size}
          fallback={fallback}
        />
      )}
      {isEditing && uid && <UploadAvatarForm onUpload={onUpload} uid={uid} />}
    </div>
  );
}
