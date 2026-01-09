"use client";

import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n/client";
import { avatarSchema } from "@/lib/schemas/uploads";
import { zodResolver } from "@hookform/resolvers/zod";
import React, { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import type { AvatarFormData } from "@/lib/schemas/uploads";

import { uploadAvatar } from "./actions";
import { AvatarPreview } from "./Avatar";

export interface UploadAvatarFormProps {
  className?: string;
  uid: string;
  onUpload?: (url: string) => void;
}

export default function UploadAvatarForm({
  className,
  uid,
  onUpload,
}: UploadAvatarFormProps) {
  const { t } = useTranslation();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const {
    handleSubmit,
    setValue,
    formState: { errors },
    reset,
  } = useForm<AvatarFormData>({
    resolver: zodResolver(avatarSchema),
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const onSubmit = async (data: AvatarFormData) => {
    if (!data.avatar || !uid) return;

    const formData = new FormData();
    formData.append("avatar", data.avatar);
    formData.append("userId", uid);

    try {
      const url = await uploadAvatar(formData);
      onUpload?.(url);
      toast.success(t("notifications.success.avatarUploaded"));
      reset();
      setPreviewUrl(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("common.errors.generic"),
      );
    }
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.currentTarget.files?.[0];
    if (file) {
      setValue("avatar", file);
      // Create a preview URL for the selected image
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      // Let form validation handle checking the file - submit directly
      handleSubmit(onSubmit)();
    }
  };

  return (
    <div className={className}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col items-center gap-4"
      >
        <AvatarPreview
          url={null}
          previewUrl={previewUrl}
          size="large"
          fallback={{
            username: null,
            full_name: null,
            email: "no.name@email.com",
          }}
        />
        <Label
          htmlFor="avatar-upload"
          className={buttonVariants({ variant: "outline" })}
        >
          Choose picture
        </Label>
        <Input
          ref={fileInputRef}
          id="avatar-upload"
          name="avatar"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          errorMsg={errors.avatar?.message}
        />
      </form>
    </div>
  );
}
