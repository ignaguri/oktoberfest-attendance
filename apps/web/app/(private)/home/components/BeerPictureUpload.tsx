"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import { Link } from "next-view-transitions";
import { startTransition, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiClient, ApiError } from "@/lib/api-client";
import { translateError, useTranslation } from "@/lib/i18n/client";
import type { SinglePictureFormData } from "@/lib/schemas/uploads";
import { singlePictureSchema } from "@/lib/schemas/uploads";

interface BeerPictureUploadProps {
  attendanceId: string | null;
}

const PicturePreview = ({ picture }: { picture: File | null }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (picture) {
      const newPreviewUrl = URL.createObjectURL(picture);
      startTransition(() => {
        setPreviewUrl(newPreviewUrl);
      });
      return () => URL.revokeObjectURL(newPreviewUrl);
    }
  }, [picture]);

  if (!previewUrl) return null;

  return (
    <div className="relative h-32 w-32">
      <Image
        src={previewUrl}
        alt="Beer picture preview"
        fill
        className="rounded object-cover"
      />
    </div>
  );
};

export function BeerPictureUpload({ attendanceId }: BeerPictureUploadProps) {
  const { t } = useTranslation();
  const [pictureAlreadyUploaded, setPictureAlreadyUploaded] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const {
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<SinglePictureFormData>({
    resolver: zodResolver(singlePictureSchema),
    defaultValues: {
      visibility: "public",
    },
  });

  const watchedPicture = watch("picture");
  const watchedVisibility = watch("visibility");

  const onSubmit = async (data: SinglePictureFormData) => {
    if (!data.picture || !attendanceId) return;

    try {
      await apiClient.photos.upload({
        picture: data.picture,
        attendanceId,
        visibility: data.visibility,
      });

      toast.success(t("notifications.success.pictureUploaded"));
      setPictureAlreadyUploaded(true);
      setShowSuccessMessage(true);
      reset();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(translateError(t, error.code, error.message));
      } else {
        toast.error(t("notifications.error.generic"));
      }
    }
  };

  if (!attendanceId) {
    return null;
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (file) {
      setValue("picture", file);
      setShowSuccessMessage(false); // Hide success message when selecting a new file
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <Input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        id="beer-picture-upload"
        errorMsg={errors.picture?.message}
      />
      <Label
        htmlFor="beer-picture-upload"
        className={buttonVariants({ variant: "outline" })}
      >
        {watchedPicture ? (
          <span>{t("attendance.pictures.chooseDifferent")}</span>
        ) : (
          <div className="flex items-center gap-2">
            <Camera size={20} />
            {pictureAlreadyUploaded ? (
              <span>{t("attendance.pictures.addAnother")}</span>
            ) : (
              <span>{t("attendance.pictures.withDrink")}</span>
            )}
          </div>
        )}
      </Label>
      <PicturePreview picture={watchedPicture || null} />

      {/* Visibility Control */}
      {watchedPicture && (
        <div className="flex items-center gap-3 rounded-md bg-gray-50">
          {watchedVisibility === "public" ? (
            <Eye size={16} className="text-green-600" />
          ) : (
            <EyeOff size={16} className="text-red-600" />
          )}
          <span className="text-sm font-medium">
            {watchedVisibility === "public"
              ? t("attendance.pictures.publicPhoto")
              : t("attendance.pictures.privatePhoto")}
          </span>
          <Switch
            checked={watchedVisibility === "public"}
            onCheckedChange={(checked) =>
              setValue("visibility", checked ? "public" : "private")
            }
          />
        </div>
      )}

      {watchedPicture && !errors.picture && (
        <Button
          type="button"
          onClick={handleSubmit(onSubmit)}
          disabled={isSubmitting}
          variant="darkYellow"
        >
          {isSubmitting
            ? t("common.status.loading")
            : t("attendance.pictures.upload", { count: 1 })}
        </Button>
      )}

      {showSuccessMessage && (
        <Alert className="max-w-xs text-center">
          {t("attendance.pictures.viewInGallery")}{" "}
          <Link className="underline" href="/attendance">
            {t("common.menu.attendance")}
          </Link>
        </Alert>
      )}
    </div>
  );
}
