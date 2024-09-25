"use client";

import cn from "classnames";
import Image from "next/image";
import React from "react";

import UploadAvatarForm from "./UploadAvatarForm";

export interface AvatarProps {
  className?: string;
  isEditing?: boolean;
  uid?: string;
  url: string | null;
  size?: "small" | "medium" | "large";
  onUpload?: (url: string) => void;
  previewUrl?: string | null;
}

const getMeasure = (size: AvatarProps["size"]) => {
  switch (size) {
    case "small":
      return 40;
    case "medium":
      return 100;
    case "large":
      return 150;
  }
};

export function AvatarPreview({
  url,
  previewUrl,
  size = "small",
}: Pick<AvatarProps, "url" | "previewUrl" | "size">) {
  const measure = getMeasure(size);
  const imageUrl = previewUrl || (url ? `/api/image/${url}` : null);

  return (
    <div
      className={cn("rounded-full overflow-hidden", {
        "border border-gray-300 bg-gray-100": !imageUrl,
      })}
      style={{ height: measure, width: measure }}
    >
      {imageUrl ? (
        <Image
          width={measure}
          height={measure}
          src={imageUrl}
          alt="Avatar"
          className="rounded-full object-cover"
          style={{ height: measure, width: measure }}
        />
      ) : (
        <div className="h-full w-full flex flex-col justify-center items-center text-center">
          <span
            className={cn("text-gray-500", {
              "text-2xl": size === "large",
              "text-lg": size === "medium",
              "text-sm leading-none": size === "small",
            })}
          >
            No
          </span>
          <span
            className={cn("text-gray-500", {
              "text-2xl": size === "large",
              "text-lg": size === "medium",
              "text-sm leading-none": size === "small",
            })}
          >
            img
          </span>
        </div>
      )}
    </div>
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
}: AvatarProps) {
  return (
    <div className={className}>
      {!isEditing && (
        <AvatarPreview url={url} previewUrl={previewUrl} size={size} />
      )}
      {isEditing && uid && <UploadAvatarForm onUpload={onUpload} uid={uid} />}
    </div>
  );
}
