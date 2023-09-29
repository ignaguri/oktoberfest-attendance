"use client";
import React, { useEffect, useState } from "react";
import { Database } from "@/lib/database.types";
import Image from "next/image";
import { useSupabase } from "@/lib/supabase-provider";

type Profiles = Database["public"]["Tables"]["profiles"]["Row"];

interface AvatarProps {
  className?: string;
  isEditing?: boolean;
  uid: string;
  url: Profiles["avatar_url"];
  size?: number;
  onUpload: (url: string) => void;
}

export default function Avatar({
  className,
  isEditing,
  uid,
  url,
  size = 150,
  onUpload,
}: AvatarProps) {
  const supabase = useSupabase();
  const [avatarUrl, setAvatarUrl] = useState<Profiles["avatar_url"]>(url);
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
    event
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

      onUpload(filePath);
    } catch (error) {
      alert("Error uploading avatar!");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={className}>
      {avatarUrl ? (
        <Image
          width={size}
          height={size}
          src={avatarUrl}
          alt="Avatar"
          className="rounded-full"
          style={{ height: size, width: size }}
        />
      ) : (
        <div
          className="border border-gray-300 bg-gray-100 rounded-full flex justify-center items-center"
          style={{ height: size, width: size }}
        >
          <span className="text-2xl text-gray-500">No image</span>
        </div>
      )}
      {isEditing && (
        <div className="mt-4" style={{ width: size }}>
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
