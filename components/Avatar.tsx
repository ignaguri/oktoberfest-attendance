"use client";

import cn from "classnames";
import React, { useEffect, useState } from "react";
import { Database } from "@/lib/database.types";
import Image from "next/image";

import { useSupabase } from "@/hooks/useSupabase";

type Profiles = Database["public"]["Tables"]["profiles"]["Row"];

export interface AvatarProps {
  className?: string;
  isEditing?: boolean;
  uid?: string;
  url: Profiles["avatar_url"];
  size?: "small" | "medium" | "large";
  onUpload?: (url: string) => void;
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

export default function Avatar({
  className,
  isEditing,
  uid,
  url,
  size = "small",
  onUpload,
}: AvatarProps) {
  const { supabase } = useSupabase();
  const [avatarUrl, setAvatarUrl] = useState<Profiles["avatar_url"]>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    async function downloadImage(path: string) {
      try {
        const { data, error } = await supabase.storage
          .from("avatars")
          .download(path);
        if (error) {
          throw error;
        }

        const url = URL.createObjectURL(data);
        setAvatarUrl(url);
      } catch (error) {
        console.log("Error downloading image: ", error);
      }
    }

    if (url) downloadImage(url);
  }, [url, supabase]);

  const uploadAvatar: React.ChangeEventHandler<HTMLInputElement> = async (
    event,
  ) => {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error("You must select an image to upload.");
      }

      const file = event.target.files[0];
      const fileExt = file.name.split(".").pop();
      const filePath = `${uid}-${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      onUpload?.(filePath);
    } catch (error) {
      alert("Error uploading avatar!");
      // TODO: reset the form somehow
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={className}>
      {avatarUrl ? (
        <Image
          width={getMeasure(size)}
          height={getMeasure(size)}
          src={avatarUrl}
          alt="Avatar"
          className="rounded-full"
          style={{ height: getMeasure(size), width: getMeasure(size) }}
        />
      ) : (
        <div
          className="border border-gray-300 bg-gray-100 rounded-full flex justify-center items-center text-center"
          style={{ height: getMeasure(size), width: getMeasure(size) }}
        >
          <span
            className={cn("text-gray-500", {
              "text-2xl": size === "large",
              "text-lg": size === "medium",
              "text-sm leading-none": size === "small",
            })}
          >
            No img
          </span>
        </div>
      )}
      {isEditing && (
        <div className="mt-4" style={{ width: getMeasure(size) }}>
          <label className="button" htmlFor="single">
            {uploading ? "Uploading..." : "Upload"}
          </label>
          <input
            style={{
              position: "absolute",
              visibility: "hidden",
            }}
            type="file"
            id="single"
            accept="image/*"
            onChange={uploadAvatar}
            disabled={uploading}
          />
        </div>
      )}
    </div>
  );
}
